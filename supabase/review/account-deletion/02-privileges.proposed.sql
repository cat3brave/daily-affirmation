-- REVIEW ONLY / NOT EXECUTED. Existing SELECT/INSERT/UPDATE/DELETE and RLS stay unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
REVOKE TRUNCATE ON TABLE public.todos, public.profiles, public.bloom_logs,
  public.favorite_affirmations, public.three_good_things FROM anon, authenticated;
-- The catalog shows BOTH PUBLIC-derived and explicit role grants for this event-trigger function.
-- Revoking only anon/authenticated is insufficient while PUBLIC retains EXECUTE.
-- Keep the postgres owner and service_role grants; do not change SECURITY DEFINER/search_path.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
COMMIT;
