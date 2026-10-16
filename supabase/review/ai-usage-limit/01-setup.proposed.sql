-- REVIEW ONLY: manual deployment after isolated verification. Not a migration.
-- Run as postgres: CREATEROLE, database/public CREATE, auth USAGE/uid EXECUTE,
-- auth.users REFERENCES and ownership/SET rights for the newly created owner. No auth grant options.
-- Name collisions fail; this script does not acquire missing administrator privileges.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $preflight$
BEGIN
  IF current_user <> 'postgres' OR
     NOT has_schema_privilege(current_user, 'auth', 'USAGE') OR
     NOT has_function_privilege(current_user, 'auth.uid()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Setup requires postgres with auth USAGE and auth.uid EXECUTE'
      USING ERRCODE = '42501';
  END IF;
END;
$preflight$;
CREATE ROLE ai_usage_limit_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT ai_usage_limit_owner TO postgres;
CREATE SCHEMA ai_usage_private AUTHORIZATION ai_usage_limit_owner;
COMMENT ON SCHEMA ai_usage_private IS 'daily-affirmation ai-usage-limit v2 identity-capability';
REVOKE ALL ON SCHEMA ai_usage_private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA ai_usage_private TO authenticated;
-- This narrow capability is the only additional postgres SECURITY DEFINER.
-- No arguments, dynamic SQL, table access, JWT parsing or configuration changes.
-- PostgREST verifies the JWT before setting the request context read by real auth.uid().
CREATE FUNCTION ai_usage_private.current_uid()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $identity$ SELECT auth.uid(); $identity$;
REVOKE ALL ON FUNCTION ai_usage_private.current_uid() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ai_usage_private.current_uid() TO ai_usage_limit_owner;

CREATE TABLE ai_usage_private.usage (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_day date NOT NULL,
  daily_count integer NOT NULL CHECK (daily_count BETWEEN 0 AND 20),
  recent timestamptz[] NOT NULL DEFAULT '{}'::timestamptz[],
  CHECK (cardinality(recent) <= 3),
  CHECK (array_position(recent, NULL) IS NULL)
);
ALTER TABLE ai_usage_private.usage OWNER TO ai_usage_limit_owner;
ALTER TABLE ai_usage_private.usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_private.usage FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE ai_usage_private.usage FROM PUBLIC, anon, authenticated, service_role;
CREATE POLICY ai_usage_owner_only ON ai_usage_private.usage
  FOR ALL TO ai_usage_limit_owner
  USING (user_id = (SELECT ai_usage_private.current_uid()))
  WITH CHECK (user_id = (SELECT ai_usage_private.current_uid()));

-- Definer is needed because authenticated must not have any table DML privileges.
-- The definer is a NOLOGIN/NOBYPASSRLS owner, confined by FORCE RLS to current_uid() (the real auth.uid()).
CREATE FUNCTION ai_usage_private.reserve()
RETURNS TABLE (allowed boolean, reason text, daily_remaining integer,
               minute_remaining integer, retry_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  v_uid uuid := ai_usage_private.current_uid();
  v_row ai_usage_private.usage%ROWTYPE;
  v_now timestamptz;
  v_day date;
  v_count integer;
  v_recent timestamptz[];
  v_minute_blocked boolean;
  v_daily_blocked boolean;
  v_retry timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  -- ON CONFLICT waits for concurrent initial inserts of this user only.
  INSERT INTO ai_usage_private.usage (user_id, usage_day, daily_count)
    VALUES (v_uid, (pg_catalog.clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date, 0)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT u.* INTO STRICT v_row FROM ai_usage_private.usage AS u
    WHERE u.user_id = v_uid FOR UPDATE;

  -- Sample AFTER lock acquisition, so a wait across midnight/window expiry is correct.
  -- now()/CURRENT_TIMESTAMP would remain fixed at transaction start.
  v_now := pg_catalog.clock_timestamp();
  v_day := (v_now AT TIME ZONE 'Asia/Tokyo')::date;
  v_count := CASE WHEN v_row.usage_day = v_day THEN v_row.daily_count ELSE 0 END;
  SELECT COALESCE(array_agg(t ORDER BY t), '{}'::timestamptz[]) INTO v_recent
    FROM pg_catalog.unnest(v_row.recent) AS t
    WHERE t > v_now - interval '60 seconds';
  v_daily_blocked := v_count >= 20;
  v_minute_blocked := cardinality(v_recent) >= 3;

  IF v_daily_blocked OR v_minute_blocked THEN
    v_retry := v_now;
    IF v_daily_blocked THEN
      v_retry := GREATEST(v_retry, (v_day + 1)::timestamp AT TIME ZONE 'Asia/Tokyo');
    END IF;
    IF v_minute_blocked THEN
      v_retry := GREATEST(v_retry, v_recent[1] + interval '60 seconds');
    END IF;
    -- No update, no rejected-event log, neither budget is consumed.
    RETURN QUERY SELECT false,
      CASE WHEN v_daily_blocked AND v_minute_blocked THEN 'daily_and_minute_limit'
           WHEN v_daily_blocked THEN 'daily_limit' ELSE 'minute_limit' END,
      20 - v_count, 3 - cardinality(v_recent), v_retry;
    RETURN;
  END IF;

  UPDATE ai_usage_private.usage AS u
    SET usage_day = v_day, daily_count = v_count + 1,
        recent = pg_catalog.array_append(v_recent, v_now)
    WHERE u.user_id = v_uid;
  RETURN QUERY SELECT true, 'allowed'::text, 19 - v_count,
    2 - cardinality(v_recent), NULL::timestamptz;
END;
$function$;
ALTER FUNCTION ai_usage_private.reserve() OWNER TO ai_usage_limit_owner;
REVOKE ALL ON FUNCTION ai_usage_private.reserve() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ai_usage_private.reserve() TO authenticated;

-- Public RPC entry is INVOKER; the privileged body stays outside exposed schemas.
CREATE FUNCTION public.reserve_ai_usage()
RETURNS TABLE (allowed boolean, reason text, daily_remaining integer,
               minute_remaining integer, retry_at timestamptz)
LANGUAGE sql VOLATILE SECURITY INVOKER
SET search_path = pg_catalog, pg_temp
AS $function$
  SELECT * FROM ai_usage_private.reserve();
$function$;
REVOKE ALL ON FUNCTION public.reserve_ai_usage() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage() TO authenticated;
-- Catalog postconditions run before COMMIT; see 02 for the same standalone checks.
DO $verify$
DECLARE
  r text;
  p text;
BEGIN
  IF obj_description('ai_usage_private'::regnamespace, 'pg_namespace') IS DISTINCT FROM
     'daily-affirmation ai-usage-limit v2 identity-capability' THEN
    RAISE EXCEPTION 'Installation marker mismatch';
  END IF;
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege(r, 'ai_usage_private.usage', p) THEN
        RAISE EXCEPTION 'Unexpected table privilege: % %', r, p;
      END IF;
    END LOOP;
    IF has_schema_privilege(r, 'ai_usage_private', 'CREATE') THEN
      RAISE EXCEPTION 'Unexpected schema CREATE: %', r;
    END IF;
    IF has_function_privilege(r, 'public.reserve_ai_usage()', 'EXECUTE')
       IS DISTINCT FROM (r = 'authenticated') OR
       has_function_privilege(r, 'ai_usage_private.reserve()', 'EXECUTE')
       IS DISTINCT FROM (r = 'authenticated') THEN
      RAISE EXCEPTION 'Unexpected EXECUTE privileges: %', r;
    END IF;
    IF has_function_privilege(r, 'ai_usage_private.current_uid()', 'EXECUTE') THEN
      RAISE EXCEPTION 'Client may not call identity capability: %', r;
    END IF;
    IF pg_has_role(r, 'ai_usage_limit_owner', 'MEMBER') THEN
      RAISE EXCEPTION 'Unexpected owner membership: %', r;
    END IF;
  END LOOP;
  IF EXISTS (SELECT FROM pg_proc AS f,
             LATERAL aclexplode(COALESCE(f.proacl, acldefault('f', f.proowner))) AS a
             WHERE f.oid IN ('public.reserve_ai_usage()'::regprocedure,
                             'ai_usage_private.reserve()'::regprocedure,
                             'ai_usage_private.current_uid()'::regprocedure)
               AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN
    RAISE EXCEPTION 'PUBLIC has EXECUTE';
  END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid='ai_usage_private.usage'::regclass) <> 1 OR
     NOT EXISTS (SELECT FROM pg_policy WHERE polrelid='ai_usage_private.usage'::regclass
       AND polname='ai_usage_owner_only' AND polcmd='*' AND polpermissive
       AND polroles=ARRAY['ai_usage_limit_owner'::regrole::oid]
       AND pg_get_expr(polqual, polrelid) LIKE '%current_uid()%'
       AND pg_get_expr(polwithcheck, polrelid) = pg_get_expr(polqual, polrelid)) THEN
    RAISE EXCEPTION 'RLS policy mismatch';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_class WHERE oid = 'ai_usage_private.usage'::regclass
      AND relrowsecurity AND relforcerowsecurity
      AND relowner = 'ai_usage_limit_owner'::regrole) THEN
    RAISE EXCEPTION 'Table owner / RLS mismatch';
  END IF;
  IF has_schema_privilege('ai_usage_limit_owner', 'auth', 'USAGE') OR
     NOT has_function_privilege('ai_usage_limit_owner', 'ai_usage_private.current_uid()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Owner must use narrow identity capability, not auth schema access';
  END IF;
  IF EXISTS (SELECT FROM pg_auth_members WHERE member = 'ai_usage_limit_owner'::regrole) THEN
    RAISE EXCEPTION 'Owner must not inherit or SET any other role';
  END IF;
  IF EXISTS (SELECT FROM pg_auth_members WHERE roleid = 'ai_usage_limit_owner'::regrole
             AND member <> 'postgres'::regrole) THEN
    RAISE EXCEPTION 'Only postgres may be a member of the owner';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_proc WHERE oid = 'ai_usage_private.current_uid()'::regprocedure
      AND prosecdef AND pronargs = 0 AND provolatile = 's'
      AND proowner = 'postgres'::regrole
      AND proconfig = ARRAY['search_path=pg_catalog, pg_temp']
      AND prosrc = ' SELECT auth.uid(); ') THEN
    RAISE EXCEPTION 'Identity capability configuration mismatch';
  END IF;
  -- Reject unknown grants from default ACLs/event triggers as well as known clients.
  IF EXISTS (SELECT FROM pg_proc f,
      LATERAL aclexplode(COALESCE(f.proacl, acldefault('f', f.proowner))) a
      WHERE f.oid IN ('public.reserve_ai_usage()'::regprocedure,
                      'ai_usage_private.reserve()'::regprocedure,
                      'ai_usage_private.current_uid()'::regprocedure)
        AND a.grantee <> f.proowner
        AND (a.is_grantable OR a.grantee <> CASE
          WHEN f.oid = 'ai_usage_private.current_uid()'::regprocedure
          THEN 'ai_usage_limit_owner'::regrole ELSE 'authenticated'::regrole END)) THEN
    RAISE EXCEPTION 'Unexpected function ACL';
  END IF;
  IF EXISTS (SELECT FROM pg_class c, LATERAL aclexplode(c.relacl) a
      WHERE c.oid = 'ai_usage_private.usage'::regclass AND a.grantee <> c.relowner) THEN
    RAISE EXCEPTION 'Unexpected table ACL';
  END IF;
  IF EXISTS (SELECT FROM pg_namespace n, LATERAL aclexplode(n.nspacl) a
      WHERE n.nspname = 'ai_usage_private' AND a.grantee <> n.nspowner
        AND (a.grantee <> 'authenticated'::regrole OR a.privilege_type <> 'USAGE' OR a.is_grantable)) THEN
    RAISE EXCEPTION 'Unexpected schema ACL';
  END IF;
  IF has_table_privilege('ai_usage_limit_owner', 'auth.users', 'SELECT') THEN
    RAISE EXCEPTION 'Owner must not read auth.users';
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ai_usage_limit_owner'
      AND (rolinherit OR rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)) THEN
    RAISE EXCEPTION 'Owner is too privileged';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_proc WHERE oid = 'ai_usage_private.reserve()'::regprocedure
      AND prosecdef AND pronargs = 0 AND provolatile = 'v'
      AND proowner = 'ai_usage_limit_owner'::regrole
      AND proconfig @> ARRAY['search_path=pg_catalog, pg_temp']) OR
     NOT EXISTS (SELECT FROM pg_proc WHERE oid = 'public.reserve_ai_usage()'::regprocedure
      AND NOT prosecdef AND pronargs = 0 AND provolatile = 'v'
      AND proowner = 'postgres'::regrole
      AND proconfig @> ARRAY['search_path=pg_catalog, pg_temp']) THEN
    RAISE EXCEPTION 'Function configuration mismatch';
  END IF;
END;
$verify$;
COMMIT;
