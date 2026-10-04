-- Run before and after separately. Each block is an independent read-only transaction.
-- Save results privately. Concurrent app writes can change fingerprints: use a quiet window.
BEGIN TRANSACTION READ ONLY;
SELECT current_user AS audit_role, current_setting('transaction_read_only') AS read_only,
       current_setting('server_version') AS postgres_version;
ROLLBACK;

BEGIN TRANSACTION READ ONLY;
SELECT n.nspname AS schema_name, r.relname AS table_name, c.conname,
       pg_get_constraintdef(c.oid) AS definition, c.convalidated, c.condeferrable,
       c.condeferred, r.relrowsecurity, r.relforcerowsecurity
FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid
JOIN pg_namespace n ON n.oid=r.relnamespace
WHERE c.contype='f' AND c.confrelid='auth.users'::regclass
ORDER BY 1,2,3;
ROLLBACK;

BEGIN TRANSACTION READ ONLY;
SELECT 'todos' AS table_name, count(*) AS rows,
 md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY t.id),'')) AS fingerprint FROM public.todos t
UNION ALL SELECT 'profiles', count(*), md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY t.id),'')) FROM public.profiles t
UNION ALL SELECT 'bloom_logs', count(*), md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY t.id),'')) FROM public.bloom_logs t
UNION ALL SELECT 'favorite_affirmations', count(*), md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY t.id),'')) FROM public.favorite_affirmations t
UNION ALL SELECT 'three_good_things', count(*), md5(coalesce(string_agg(md5(row_to_json(t)::text),'' ORDER BY t.id),'')) FROM public.three_good_things t;
ROLLBACK;

BEGIN TRANSACTION READ ONLY;
SELECT c.relname AS table_name, roles.role_name,
 has_table_privilege(roles.role_name,c.oid,'TRUNCATE') AS can_truncate,
 has_table_privilege(roles.role_name,c.oid,'SELECT') AS can_select,
 has_table_privilege(roles.role_name,c.oid,'INSERT') AS can_insert,
 has_table_privilege(roles.role_name,c.oid,'UPDATE') AS can_update,
 has_table_privilege(roles.role_name,c.oid,'DELETE') AS can_delete
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) roles(role_name)
WHERE n.nspname='public' AND c.relname IN ('todos','profiles','bloom_logs','favorite_affirmations','three_good_things')
ORDER BY 1,2;
ROLLBACK;

BEGIN TRANSACTION READ ONLY;
SELECT roles.role_name, has_function_privilege(roles.role_name,'public.rls_auto_enable()','EXECUTE') AS can_execute
FROM (VALUES ('anon'),('authenticated'),('postgres'),('service_role')) roles(role_name);
ROLLBACK;

BEGIN TRANSACTION READ ONLY;
SELECT e.evtname,e.evtenabled,p.prosecdef,p.prorettype::regtype::text AS return_type,
       pg_get_userbyid(p.proowner) AS owner, p.proconfig, p.proacl,
       pg_get_functiondef(p.oid) AS definition
FROM pg_event_trigger e JOIN pg_proc p ON p.oid=e.evtfoid
WHERE p.oid='public.rls_auto_enable()'::regprocedure;
ROLLBACK;

BEGIN TRANSACTION READ ONLY;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public' AND tablename IN
 ('todos','profiles','bloom_logs','favorite_affirmations','three_good_things','account_deletion_operations')
ORDER BY tablename, policyname;
ROLLBACK;

BEGIN TRANSACTION READ ONLY;
SELECT (SELECT count(*) FROM storage.buckets) AS buckets,
       (SELECT count(*) FROM storage.objects) AS objects;
ROLLBACK;

-- Only after proposal 03 exists:
BEGIN TRANSACTION READ ONLY;
SELECT n.nspname,c.relname,c.relrowsecurity,roles.role_name,
 has_table_privilege(roles.role_name,c.oid,'SELECT') AS can_select,
 has_table_privilege(roles.role_name,c.oid,'INSERT') AS can_insert,
 has_table_privilege(roles.role_name,c.oid,'UPDATE') AS can_update,
 has_table_privilege(roles.role_name,c.oid,'DELETE') AS can_delete
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) roles(role_name)
WHERE n.nspname='public' AND c.relname='account_deletion_operations';
ROLLBACK;
