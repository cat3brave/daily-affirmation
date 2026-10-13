-- REVIEW ONLY: stop future callers first. Removes only objects from 01-setup.
-- Usage history in the NEW table is lost. No existing application table is touched.
-- No CASCADE / DROP OWNED: unexpected dependencies cause a safe failure.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DROP FUNCTION public.reserve_ai_usage();
DROP FUNCTION ai_usage_private.reserve();
DROP TABLE ai_usage_private.usage;
DROP SCHEMA ai_usage_private;
REVOKE EXECUTE ON FUNCTION auth.uid() FROM ai_usage_limit_owner;
REVOKE USAGE ON SCHEMA auth FROM ai_usage_limit_owner;
REVOKE ai_usage_limit_owner FROM postgres;
DROP ROLE ai_usage_limit_owner;
COMMIT;
