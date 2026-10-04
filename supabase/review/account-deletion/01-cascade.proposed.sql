-- REVIEW ONLY / NOT EXECUTED. Not a Supabase migration and never loaded by the app.
-- Confirm the target project outside SQL. Run staging tests before production review.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
LOCK TABLE public.bloom_logs, public.profiles, public.todos IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_constraint c
      WHERE c.contype = 'f' AND c.confrelid = 'auth.users'::regclass
        AND c.convalidated AND NOT c.condeferrable AND NOT c.condeferred
        AND c.confdeltype = 'a' AND c.confupdtype = 'a'
        AND (c.conrelid, c.conname) IN
          (('public.bloom_logs'::regclass,'bloom_logs_user_id_fkey'),
           ('public.profiles'::regclass,'profiles_id_fkey'),
           ('public.todos'::regclass,'todos_user_id_fkey'))
        AND pg_get_constraintdef(c.oid) IN
          ('FOREIGN KEY (user_id) REFERENCES auth.users(id)', 'FOREIGN KEY (id) REFERENCES auth.users(id)')) <> 3
  THEN RAISE EXCEPTION 'Foreign-key baseline differs: stop and re-audit'; END IF;
END $$;
ALTER TABLE public.bloom_logs DROP CONSTRAINT bloom_logs_user_id_fkey,
  ADD CONSTRAINT bloom_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey,
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.todos DROP CONSTRAINT todos_user_id_fkey,
  ADD CONSTRAINT todos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
COMMIT;
