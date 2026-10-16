-- REVIEW ONLY: run with the same authorized administrator as setup; stop future callers first. Removes only objects from 01-setup.
-- Usage history in the NEW table is lost. No existing application table is touched.
-- No CASCADE / DROP OWNED: unexpected dependencies cause a safe failure.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- Refuse a mismatched installation before dropping anything. Same checks as 02.
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
DROP FUNCTION public.reserve_ai_usage();
DROP FUNCTION ai_usage_private.reserve();
DROP TABLE ai_usage_private.usage;
DROP FUNCTION ai_usage_private.current_uid();
DROP SCHEMA ai_usage_private;
REVOKE ai_usage_limit_owner FROM postgres;
DROP ROLE ai_usage_limit_owner;
COMMIT;
