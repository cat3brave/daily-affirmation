#!/usr/bin/env python3
"""Only creates its own disposable Unix-socket PostgreSQL cluster; no URL option."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import shutil
import signal
import subprocess
import tempfile
import threading

ROOT = Path(__file__).resolve().parent
A = '00000000-0000-0000-0000-000000000001'
B = '00000000-0000-0000-0000-000000000002'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Check binaries only; do not create a DB')
    parser.add_argument('--cleanup-probe', choices=('failure', 'sigterm'),
                        help='Disposable lifecycle probe; intentionally exits nonzero after setup')
    args = parser.parse_args()
    binaries = {name: shutil.which(name) for name in ('initdb', 'pg_ctl', 'psql')}
    missing = [name for name, path in binaries.items() if path is None]
    if missing:
        parser.exit(2, 'DB TEST NOT RUN: missing ' + ', '.join(missing) + '\n')
    if args.check:
        print('PostgreSQL binaries available; DB tests not run')
        return
    if hasattr(os, 'geteuid') and os.geteuid() == 0:
        parser.exit(2, 'DB TEST NOT RUN: run initdb as an unprivileged OS user\n')
    # Pass no inherited connection settings or credentials to PostgreSQL tools.
    env = {k: os.environ[k] for k in ('PATH', 'LANG', 'LC_ALL', 'TZ') if k in os.environ}

    def terminate(signum, frame):
        raise SystemExit(f'DB TEST INTERRUPTED: signal {signum}')

    signal.signal(signal.SIGTERM, terminate)
    with tempfile.TemporaryDirectory(prefix='ai-usage-local-') as directory:
        base = Path(directory)
        print(f'Disposable cluster: {base}', flush=True)
        env['HOME'] = str(base)  # No inherited .pgpass / .pg_service.conf.
        for name, binary in binaries.items():
            print(subprocess.check_output([binary, '--version'], env=env, text=True).strip(), flush=True)
        data = base / 'data'
        socket = base / 'socket'
        socket.mkdir(mode=0o700)
        subprocess.run([binaries['initdb'], '-D', str(data), '-U', 'fixture_admin', '--auth=trust', '--no-locale'],
                       env=env, check=True, stdout=subprocess.DEVNULL, timeout=30)
        ctl = [binaries['pg_ctl'], '-D', str(data)]
        try:
            subprocess.run(ctl + ['-l', str(base / 'server.log'), '-o',
                           f"-k {socket} -h '' -p 55439", '-w', 'start'],
                           env=env, check=True, stdout=subprocess.DEVNULL, timeout=30)
            command = [binaries['psql'], '-X', '-qAt', '-v', 'ON_ERROR_STOP=1',
                       '-h', str(socket), '-p', '55439', '-U', 'fixture_admin', '-d', 'postgres']

            def sql(statement, error=None, deploy=False):
                selected = command.copy()
                if deploy:
                    selected[selected.index('-U') + 1] = 'postgres'
                result = subprocess.run(selected, input="\\set VERBOSITY verbose\nSET timezone='UTC';\n" + statement,
                                        text=True, capture_output=True, env=env, timeout=20)
                if error:
                    assert result.returncode != 0 and error in result.stderr, result.stderr
                    return result.stderr
                assert result.returncode == 0, result.stderr
                return result.stdout.strip()

            def call(uid=A, role='authenticated', statement='SELECT row_to_json(r) FROM public.reserve_ai_usage() r;'):
                # All identifiers/UUIDs here are fixed fixtures, never user input.
                return f"SET SESSION AUTHORIZATION {role}; BEGIN; SET LOCAL ROLE {role}; SET LOCAL request.jwt.claim.sub = '{uid}'; {statement} COMMIT;"

            import json

            def reserve(uid=A):
                return json.loads(sql(call(uid)))

            def reset(count=0, recent="'{}'::timestamptz[]", day="(clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date"):
                sql(f"DELETE FROM ai_usage_private.usage; INSERT INTO ai_usage_private.usage VALUES ('{A}', {day}, {count}, {recent});")

            def parallel(expected):
                # First independent transaction reserves and holds the per-user lock.
                # Other 11 connections must remain blocked until that transaction commits.
                holder = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                          stderr=subprocess.PIPE, text=True, env=env)
                try:
                    holder.stdin.write(call(statement="SELECT allowed FROM public.reserve_ai_usage();\n").replace(' COMMIT;', '\n'))
                    holder.stdin.flush()
                    import select

                    def read_line():
                        assert select.select([holder.stdout], [], [], 10)[0], 'Holder response timed out'
                        return holder.stdout.readline().strip()

                    assert read_line() == 't'
                    barrier = threading.Barrier(12)

                    def worker():
                        barrier.wait(timeout=10)
                        return reserve()

                    with ThreadPoolExecutor(max_workers=11) as pool:
                        futures = [pool.submit(worker) for _ in range(11)]
                        barrier.wait(timeout=10)
                        # Read pg_stat_activity on another connection, don't assume overlap.
                        import time
                        deadline = time.monotonic() + 10
                        while int(sql("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Lock';")) < 11:
                            assert time.monotonic() < deadline, 'Workers did not overlap under DB locks'
                            time.sleep(0.05)
                        assert reserve(B)['allowed'], 'User B should proceed while A is locked'
                        holder.stdin.write('COMMIT;\n\\q\n')
                        holder.stdin.flush()
                        holder.wait(timeout=10)
                        assert holder.returncode == 0, holder.stderr.read()
                        results = [future.result() for future in futures]
                    assert 1 + sum(r['allowed'] for r in results) == expected, results
                    print(f'PASS parallel: 12 connections, {expected} allowed, 11 observed lock waits')
                finally:
                    if holder.poll() is None:
                        holder.kill()
                        holder.wait()
                    holder.stdin.close()
                    holder.stdout.close()
                    holder.stderr.close()

            sql((ROOT / '03-fixture.local-only.sql').read_text())
            sql('CREATE ROLE postgres LOGIN NOSUPERUSER CREATEROLE BYPASSRLS; '
                'GRANT authenticated TO postgres; '
                'GRANT CREATE ON DATABASE postgres TO postgres; '
                'GRANT CREATE ON SCHEMA public TO postgres; '
                'GRANT USAGE ON SCHEMA auth TO postgres; '
                'GRANT REFERENCES ON auth.users TO postgres;')
            from deployment_checks import check_deployment
            deploy = lambda statement, error=None: sql(statement, error=error, deploy=True)
            check_deployment(deploy, sql)
            deploy((ROOT / '02-verify.readonly.sql').read_text())
            if args.cleanup_probe:
                print('INJECTED cleanup probe: ' + args.cleanup_probe, flush=True)
                if args.cleanup_probe == 'sigterm':
                    os.kill(os.getpid(), signal.SIGTERM)
                raise RuntimeError('Intentional cleanup failure probe')
            print('DB server: ' + sql('SELECT version();'))
            print('PASS SQL setup / catalog privileges / RLS / function owners')
            print('PRODUCTION FUNCTION tests: original clock_timestamp definition')
            sql(call(role='anon'), error='42501')
            sql(call(uid=''), error='28000')
            sql(call(statement="SELECT * FROM ai_usage_private.usage;"), error='42501')
            for operation in (
                f"INSERT INTO ai_usage_private.usage VALUES ('{B}', CURRENT_DATE, 0, '{{}}');",
                "UPDATE ai_usage_private.usage SET daily_count=0;",
                "DELETE FROM ai_usage_private.usage;", "TRUNCATE ai_usage_private.usage;",
                "ALTER TABLE ai_usage_private.usage DISABLE ROW LEVEL SECURITY;",
                "SET ROLE ai_usage_limit_owner;",
                f"SELECT public.reserve_ai_usage('{B}'::uuid);",
            ):
                sql(call(statement=operation), error='42883' if '::uuid' in operation else '42501')
            print('PASS anon / missing uid / read / DML / reset / arbitrary user argument rejected')
            assert reserve(A)['daily_remaining'] == 19
            assert reserve(B)['daily_remaining'] == 19
            assert reserve(A)['daily_remaining'] == 18
            assert sql(f"BEGIN; SET LOCAL ROLE ai_usage_limit_owner; SET LOCAL request.jwt.claim.sub='{A}'; SELECT count(*) FROM ai_usage_private.usage WHERE user_id='{B}'; COMMIT;") == '0'
            print('PASS independent users A/B / FORCE RLS owner cannot read B as A')
            sql('DELETE FROM ai_usage_private.usage;')
            parallel(3)  # First-row creation, uncommitted competing insertion paths.
            before = sql('SELECT row_to_json(u) FROM ai_usage_private.usage u;')
            assert reserve()['reason'] == 'minute_limit'
            assert sql('SELECT row_to_json(u) FROM ai_usage_private.usage u;') == before
            # Both future operations use the SAME zero-argument RPC: no operation dimension.
            for operation in ('affirmation', 'translation'):
                assert not reserve()['allowed'], operation
            print('PASS rolling 60s maximum / shared operation budget / denied state unchanged')
            reset(19)
            parallel(1)
            assert sql(f"SELECT daily_count FROM ai_usage_private.usage WHERE user_id='{A}';") == '20'
            before = sql('SELECT row_to_json(u) FROM ai_usage_private.usage u;')
            assert reserve()['reason'] == 'daily_limit'
            assert sql('SELECT row_to_json(u) FROM ai_usage_private.usage u;') == before
            print('PASS daily final slot / no minute consumption on daily denial')

            # Admin-only clock fixture in this disposable cluster. Replace ONLY the two
            # clock_timestamp() expressions locally; no production args / config knobs.
            print('CLOCK FIXTURE tests: only boundary tests replace clock_timestamp')
            original = sql("SELECT pg_get_functiondef('ai_usage_private.reserve()'::regprocedure);")
            sql("CREATE TABLE public.ai_usage_test_clock (t timestamptz NOT NULL); "
                "INSERT INTO public.ai_usage_test_clock VALUES ('2026-10-13 14:59:59+00'); "
                "CREATE FUNCTION public.ai_usage_test_now() RETURNS timestamptz LANGUAGE sql VOLATILE SECURITY DEFINER "
                "SET search_path=pg_catalog AS 'SELECT t FROM public.ai_usage_test_clock'; "
                "REVOKE ALL ON FUNCTION public.ai_usage_test_now() FROM PUBLIC; "
                "GRANT EXECUTE ON FUNCTION public.ai_usage_test_now() TO ai_usage_limit_owner;")
            assert original.count('pg_catalog.clock_timestamp()') == 2
            sql(original.replace('pg_catalog.clock_timestamp()', 'public.ai_usage_test_now()'))
            reset(19, day="'2026-10-13'::date")
            assert reserve()['allowed']  # JST 23:59:59, day count becomes 20.
            sql("UPDATE public.ai_usage_test_clock SET t='2026-10-13 15:00:00+00';")
            assert reserve()['daily_remaining'] == 19  # JST midnight, old event retained.
            assert reserve()['allowed']
            denied = reserve()
            assert denied['reason'] == 'minute_limit' and denied['minute_remaining'] == 0
            assert denied['retry_at'].startswith('2026-10-13T15:00:59')
            sql("UPDATE public.ai_usage_test_clock SET t='2026-10-13 15:00:59+00';")
            assert reserve()['allowed']  # exact 60-second expiry excluded
            # Both full just before midnight: minute wait extends beyond day reset.
            sql("UPDATE public.ai_usage_test_clock SET t='2026-10-13 14:59:59+00';")
            reset(20, "ARRAY['2026-10-13 14:59:40+00'::timestamptz,'2026-10-13 14:59:45+00'::timestamptz,'2026-10-13 14:59:50+00'::timestamptz]", "'2026-10-13'::date")
            denied = reserve()
            assert denied['reason'] == 'daily_and_minute_limit'
            assert denied['retry_at'].startswith('2026-10-13T15:00:40')
            # Day wait dominates when minute expires earlier.
            sql("UPDATE public.ai_usage_test_clock SET t='2026-10-13 03:00:00+00';")
            reset(20, "ARRAY['2026-10-13 02:59:50+00'::timestamptz,'2026-10-13 02:59:55+00'::timestamptz,'2026-10-13 02:59:59+00'::timestamptz]", "'2026-10-13'::date")
            assert reserve()['retry_at'].startswith('2026-10-13T15:00:00')
            sql(original)
            assert sql("SELECT pg_get_functiondef('ai_usage_private.reserve()'::regprocedure);") == original
            sql((ROOT / '02-verify.readonly.sql').read_text())
            sql('DROP FUNCTION public.ai_usage_test_now(); DROP TABLE public.ai_usage_test_clock;')
            print('PASS admin clock fixture: JST boundary / cross-day window / exact 60s / max retry_at; original restored')

            # A forced UPDATE failure must roll back the first-row INSERT too.
            sql('DELETE FROM ai_usage_private.usage; '
                "CREATE FUNCTION public.ai_usage_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ "
                "BEGIN RAISE EXCEPTION 'fixture failure' USING ERRCODE='P0001'; END; $$; "
                'CREATE TRIGGER ai_usage_test_fail BEFORE UPDATE ON ai_usage_private.usage '
                'FOR EACH ROW EXECUTE FUNCTION public.ai_usage_test_fail();')
            sql(call(), error='P0001')
            assert sql('SELECT count(*) FROM ai_usage_private.usage;') == '0'
            sql('DROP TRIGGER ai_usage_test_fail ON ai_usage_private.usage; DROP FUNCTION public.ai_usage_test_fail();')
            reset()
            before = sql('SELECT row_to_json(u) FROM ai_usage_private.usage u;')
            sql(call(statement="SELECT * FROM public.reserve_ai_usage(); SELECT 1/0;"), error='22012')
            assert sql('SELECT row_to_json(u) FROM ai_usage_private.usage u;') == before
            print('PASS transaction integrity: insert/update rollback and post-reservation DB failure')
            locker = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                      stderr=subprocess.PIPE, text=True, env=env)
            try:
                locker.stdin.write(f"BEGIN; SELECT user_id FROM ai_usage_private.usage WHERE user_id='{A}' FOR UPDATE;\n")
                locker.stdin.flush()
                import select
                assert select.select([locker.stdout], [], [], 10)[0], 'Lock fixture timed out'
                assert locker.stdout.readline().strip() == A
                sql(call(statement="SET LOCAL lock_timeout='100ms'; SELECT * FROM public.reserve_ai_usage();"), error='55P03')
                assert sql('SELECT row_to_json(u) FROM ai_usage_private.usage u;') == before
                locker.stdin.write('ROLLBACK;\n\\q\n')
                locker.stdin.flush()
                locker.wait(timeout=10)
                assert locker.returncode == 0, locker.stderr.read()
                print('PASS lock timeout leaves counters unchanged')
            finally:
                if locker.poll() is None:
                    locker.kill()
                    locker.wait()
                locker.stdin.close()
                locker.stdout.close()
                locker.stderr.close()
            # Only the new FK cascade: synthetic auth user deletion.
            sql(f"DELETE FROM auth.users WHERE id='{A}';")
            assert sql('SELECT count(*) FROM ai_usage_private.usage;') == '0'
            sql(call(), error='23503')
            assert sql('SELECT count(*) FROM ai_usage_private.usage;') == '0'
            print('PASS deleted uid rejected by FK; no usage row recreated')
            deploy((ROOT / '05-rollback.proposed.sql').read_text())
            assert sql("SELECT to_regprocedure('public.reserve_ai_usage()') IS NULL;") == 't'
            assert sql("SELECT count(*) FROM pg_namespace WHERE nspname='ai_usage_private';") == '0'
            assert sql("SELECT count(*) FROM pg_roles WHERE rolname='ai_usage_limit_owner';") == '0'
            assert sql('SELECT value FROM public.ai_usage_test_sentinel;') == 'keep'
            assert sql('SELECT count(*) FROM auth.users;') == '1'
            print('PASS user cascade / rollback removes only new objects; sentinel and user B preserved')
            print('PASS ALL isolated PostgreSQL tests (auth stub; real Supabase API not tested)')
        finally:
            subprocess.run(ctl + ['-m', 'immediate', '-w', 'stop'], env=env,
                           stdout=subprocess.DEVNULL, timeout=30, check=True)
            print('CLEANUP: own PostgreSQL cluster stopped; temporary files removed on exit', flush=True)


if __name__ == '__main__':
    main()
