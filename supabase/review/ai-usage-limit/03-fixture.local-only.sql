-- DISPOSABLE LOCAL CLUSTER ONLY, never load this into Supabase/shared databases.
-- Minimal auth.uid() model; not a verification of JWT signatures or PostgREST.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.sub', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
$$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
INSERT INTO auth.users VALUES
 ('00000000-0000-0000-0000-000000000001'),
 ('00000000-0000-0000-0000-000000000002');
-- Existing-object sentinel: rollback must preserve this row and auth.users.
CREATE TABLE public.ai_usage_test_sentinel (value text);
INSERT INTO public.ai_usage_test_sentinel VALUES ('keep');
