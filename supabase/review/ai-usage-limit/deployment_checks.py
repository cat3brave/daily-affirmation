"""Shared disposable-DB deployment checks. No remote connections or admin acquisition."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def check_deployment(deploy, fixture):
    """Leave setup installed. fixture is preparation only; deploy must use postgres."""
    setup = (ROOT / '01-setup.proposed.sql').read_text()
    verify = (ROOT / '02-verify.readonly.sql').read_text()
    rollback = (ROOT / '05-rollback.proposed.sql').read_text()
    assert deploy("SELECT current_user = 'postgres' AND NOT rolsuper AND rolcreaterole AND rolbypassrls "
                  "AND has_schema_privilege(current_user, 'auth', 'USAGE') "
                  "AND NOT has_schema_privilege(current_user, 'auth', 'USAGE WITH GRANT OPTION') "
                  "AND has_function_privilege(current_user, 'auth.uid()', 'EXECUTE') "
                  "AND NOT has_function_privilege(current_user, 'auth.uid()', 'EXECUTE WITH GRANT OPTION') "
                  "FROM pg_roles WHERE rolname=current_user;") == 't'
    assert deploy("SELECT NOT EXISTS (SELECT FROM pg_auth_members WHERE member='postgres'::regrole "
                  "AND roleid IN (SELECT oid FROM pg_roles WHERE rolname IN ('supabase_admin','supabase_auth_admin')));") == 't'
    print('PASS deployment identity: postgres non-superuser, no auth grant options or admin membership', flush=True)

    def absent():
        assert deploy("SELECT to_regnamespace('ai_usage_private') IS NULL "
                      "AND to_regprocedure('public.reserve_ai_usage()') IS NULL "
                      "AND NOT EXISTS (SELECT FROM pg_roles WHERE rolname='ai_usage_limit_owner');") == 't'

    absent()
    fixture("CREATE TABLE public.ai_usage_deployment_sentinel (value text); "
            "INSERT INTO public.ai_usage_deployment_sentinel VALUES ('keep');")
    existing_users = fixture("SELECT coalesce(json_agg(id ORDER BY id), '[]') FROM auth.users;")
    # A client role cannot deploy, even when reached through a postgres session.
    deploy("BEGIN; SET LOCAL ROLE authenticated;\n" +
           setup.replace('BEGIN;\nSET LOCAL lock_timeout', 'SET LOCAL lock_timeout', 1),
           error='42501')
    absent()
    # Later public function collision must roll back the newly created role/schema.
    fixture('CREATE FUNCTION public.reserve_ai_usage() RETURNS integer LANGUAGE sql AS $$ SELECT 7 $$;')
    deploy(setup, error='42723')
    assert deploy('SELECT public.reserve_ai_usage();') == '7'
    assert deploy("SELECT to_regnamespace('ai_usage_private') IS NULL AND NOT EXISTS "
                  "(SELECT FROM pg_roles WHERE rolname='ai_usage_limit_owner');") == 't'
    fixture('DROP FUNCTION public.reserve_ai_usage();')
    # Early role and schema collisions must preserve the pre-existing objects.
    fixture('CREATE ROLE ai_usage_limit_owner NOLOGIN;')
    deploy(setup, error='42710')
    fixture('DROP ROLE ai_usage_limit_owner; CREATE SCHEMA ai_usage_private;')
    deploy(setup, error='42P06')
    assert deploy("SELECT NOT EXISTS (SELECT FROM pg_roles WHERE rolname='ai_usage_limit_owner');") == 't'
    fixture('DROP SCHEMA ai_usage_private;')
    absent()
    print('PASS missing privilege / role, schema and RPC collisions: atomic failure and existing objects preserved', flush=True)
    # Existing default ACLs and enabled event triggers are never disabled to pass.
    catalogs = ("SELECT json_build_array("
                "(SELECT coalesce(json_agg(row_to_json(x)), '[]') FROM "
                "(SELECT * FROM pg_default_acl ORDER BY oid) x),"
                "(SELECT coalesce(json_agg(row_to_json(x)), '[]') FROM "
                "(SELECT * FROM pg_event_trigger ORDER BY oid) x));")
    before = fixture(catalogs)
    deploy(setup)
    deploy(verify)
    assert fixture(catalogs) == before
    # RESTRICT failure must preserve the whole installation, even after the first
    # DROP in rollback; never remove an unknown dependent view with CASCADE.
    fixture('CREATE VIEW public.ai_usage_dependency_probe AS SELECT * FROM ai_usage_private.usage;')
    deploy(rollback, error='2BP01')
    deploy(verify)
    fixture('DROP VIEW public.ai_usage_dependency_probe;')
    deploy(rollback)
    absent()
    assert fixture('SELECT value FROM public.ai_usage_deployment_sentinel;') == 'keep'
    assert fixture("SELECT coalesce(json_agg(id ORDER BY id), '[]') FROM auth.users;") == existing_users
    fixture('DROP TABLE public.ai_usage_deployment_sentinel;')
    assert fixture(catalogs) == before
    deploy(setup)
    deploy(verify)
    print('PASS postgres setup/verify/rollback/reinstall; RESTRICT protects unknown dependency; defaults/triggers unchanged', flush=True)
