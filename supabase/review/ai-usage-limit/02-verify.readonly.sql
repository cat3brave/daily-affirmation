-- Read-only catalog assertions. Run as administrator after setup.
BEGIN READ ONLY;
DO $verify$
DECLARE
  r text;
  p text;
BEGIN
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
    IF pg_has_role(r, 'ai_usage_limit_owner', 'MEMBER') THEN
      RAISE EXCEPTION 'Unexpected owner membership: %', r;
    END IF;
  END LOOP;
  IF EXISTS (SELECT FROM pg_proc AS f,
             LATERAL aclexplode(COALESCE(f.proacl, acldefault('f', f.proowner))) AS a
             WHERE f.oid IN ('public.reserve_ai_usage()'::regprocedure,
                             'ai_usage_private.reserve()'::regprocedure)
               AND a.grantee = 0 AND a.privilege_type = 'EXECUTE') THEN
    RAISE EXCEPTION 'PUBLIC has EXECUTE';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_class WHERE oid = 'ai_usage_private.usage'::regclass
      AND relrowsecurity AND relforcerowsecurity
      AND relowner = 'ai_usage_limit_owner'::regrole) THEN
    RAISE EXCEPTION 'Table owner / RLS mismatch';
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ai_usage_limit_owner'
      AND (rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication)) THEN
    RAISE EXCEPTION 'Owner is too privileged';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_proc WHERE oid = 'ai_usage_private.reserve()'::regprocedure
      AND prosecdef AND pronargs = 0 AND provolatile = 'v'
      AND proowner = 'ai_usage_limit_owner'::regrole
      AND proconfig @> ARRAY['search_path=pg_catalog, pg_temp']) OR
     NOT EXISTS (SELECT FROM pg_proc WHERE oid = 'public.reserve_ai_usage()'::regprocedure
      AND NOT prosecdef AND pronargs = 0 AND provolatile = 'v'
      AND proconfig @> ARRAY['search_path=pg_catalog, pg_temp']) THEN
    RAISE EXCEPTION 'Function configuration mismatch';
  END IF;
END;
$verify$;
-- Inspect: only owner policy with auth.uid(), no client policy.
SELECT policyname, roles, cmd, qual, with_check FROM pg_policies
  WHERE schemaname = 'ai_usage_private';
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
  WHERE conrelid = 'ai_usage_private.usage'::regclass;
COMMIT;
