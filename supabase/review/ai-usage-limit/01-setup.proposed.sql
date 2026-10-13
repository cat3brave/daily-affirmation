-- REVIEW ONLY: manual deployment after isolated verification. Not a migration.
-- Run as postgres (role creation/ownership privileges required). Name collisions fail.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE ROLE ai_usage_limit_owner NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT ai_usage_limit_owner TO postgres;
CREATE SCHEMA ai_usage_private AUTHORIZATION ai_usage_limit_owner;
REVOKE ALL ON SCHEMA ai_usage_private FROM PUBLIC, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA ai_usage_private TO authenticated;
GRANT USAGE ON SCHEMA auth TO ai_usage_limit_owner;
GRANT EXECUTE ON FUNCTION auth.uid() TO ai_usage_limit_owner;

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
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Definer is needed because authenticated must not have any table DML privileges.
-- The definer is a NOLOGIN/NOBYPASSRLS owner, confined by FORCE RLS to auth.uid().
CREATE FUNCTION ai_usage_private.reserve()
RETURNS TABLE (allowed boolean, reason text, daily_remaining integer,
               minute_remaining integer, retry_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $function$
DECLARE
  v_uid uuid := auth.uid();
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
COMMIT;
