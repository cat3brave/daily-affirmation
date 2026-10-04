-- REVIEW ONLY / NOT EXECUTED. Disable the app flag first; resolve in-flight operations first.
-- These restore the audited definitions/ACLs, not deleted data. Never run blindly on a drifted DB.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
ALTER TABLE public.bloom_logs DROP CONSTRAINT bloom_logs_user_id_fkey,
  ADD CONSTRAINT bloom_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE NO ACTION;
ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey,
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE NO ACTION;
ALTER TABLE public.todos DROP CONSTRAINT todos_user_id_fkey,
  ADD CONSTRAINT todos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE NO ACTION;
COMMIT;

-- ACL rollback is OPTIONAL: it restores excess privileges, so prefer keeping the hardening.
BEGIN;
GRANT TRUNCATE ON TABLE public.todos, public.profiles, public.bloom_logs,
  public.favorite_affirmations, public.three_good_things TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC, anon, authenticated;
COMMIT;
-- Keep account_deletion_operations for reconciliation. Do not drop it or erase unknown operations.
