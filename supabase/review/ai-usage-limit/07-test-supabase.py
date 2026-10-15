#!/usr/bin/env python3
"""Own disposable Supabase only; no URL, project, credential or SQL overrides."""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import http.client
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import socket
import subprocess
import tempfile
import threading
import time
import uuid

ROOT = Path(__file__).resolve().parent
CLI_VERSION = '2.81.3'
# Only this task's own local daemon; ignore inherited remote Docker selectors.
DOCKER = ['docker', '--host=unix:///var/run/docker.sock']
ENV = {k: os.environ[k] for k in ('PATH', 'LANG', 'LC_ALL', 'DOCKER_CONFIG') if k in os.environ}
# Workflow fallback knows only a non-secret path, never keys or Auth responses.
MARKER = Path(os.environ.get('RUNNER_TEMP', tempfile.gettempdir())) / 'ai-usage-supabase-owned.json'


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def run(command, *, data=None, timeout=60):
    result = subprocess.run(command, input=data, text=True, capture_output=True,
                            env=ENV, timeout=timeout, cwd=tempfile.gettempdir())
    # Never include captured stdout/stderr or argv in failures: they may contain secrets.
    if result.returncode:
        for hint in ('permission denied', 'connection refused', 'failed to pull', 'manifest unknown',
                     'no space left', 'unhealthy', 'network is unreachable', 'TLS handshake timeout',
                     'i/o timeout', 'context deadline exceeded', 'unknown field', 'invalid config',
                     'failed to parse', 'Error response from daemon', '403 Forbidden'):
            if hint.lower() in result.stderr.lower():
                print('Diagnostic category: ' + hint, flush=True)
        raise RuntimeError(f'{Path(command[0]).name} failed (exit {result.returncode})')
    return result.stdout.strip()


def inspect(name):
    return json.loads(run(DOCKER + ['inspect', name]))[0]


def owned(base, project):
    require(re.fullmatch(r'ai-usage-http-[0-9a-f]{16}', project), 'Invalid owned project')
    require(base.parent == Path(tempfile.gettempdir()) and base.name == project,
            'Invalid owned temporary directory')
    require(not base.is_symlink(), 'Symlink temporary directory refused')
    config = base / 'supabase/config.toml'
    require(config.is_file() and f'project_id = "{project}"' in config.read_text(),
            'Owned config missing')


def cleanup(base, project):
    owned(base, project)
    run(['supabase', '--workdir', str(base), 'stop', '--project-id', project, '--no-backup'], timeout=75)
    for kind in ('container', 'volume', 'network'):
        remaining = run(DOCKER + [kind, 'ls', '--filter', f'label=com.supabase.cli.project={project}',
                                 '--format', '{{.ID}}'])
        require(not remaining, f'Owned {kind} survived cleanup')
    shutil.rmtree(base)
    MARKER.unlink(missing_ok=True)
    print('PASS cleanup: owned containers/volumes/network and temporary files removed', flush=True)


def decode(part):
    return json.loads(base64.urlsafe_b64decode(part + '=' * (-len(part) % 4)))


def encode(value):
    return base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':')).encode()).decode().rstrip('=')


def unbase64(value):
    return base64.urlsafe_b64decode(value + '=' * (-len(value) % 4))


def sign_es256(header, payload, key):
    """Use OpenSSL with a memory-only SEC1 key; convert DER ECDSA to JWT r||s."""
    require(header['alg'] == 'ES256' and key['kty'] == 'EC' and key['crv'] == 'P-256'
            and key['kid'] == header['kid'], 'ES256 key/header mismatch')
    d, x, y = (unbase64(key[name]) for name in ('d', 'x', 'y'))
    require(all(len(v) == 32 for v in (d, x, y)), 'Unexpected P-256 key length')
    # RFC 5915 ECPrivateKey, named curve prime256v1, uncompressed public point.
    der_key = bytes.fromhex('30770201010420') + d + bytes.fromhex('a00a06082a8648ce3d030107a14403420004') + x + y
    message = encode(header) + '.' + encode(payload)
    fd = os.memfd_create('ai-usage-ephemeral-signing-key', os.MFD_CLOEXEC)
    try:
        os.write(fd, der_key)
        os.lseek(fd, 0, os.SEEK_SET)
        result = subprocess.run(['openssl', 'dgst', '-sha256', '-keyform', 'DER',
                                 '-sign', f'/proc/self/fd/{fd}'], input=message.encode(),
                                capture_output=True, env=ENV, pass_fds=(fd,), timeout=10)
        require(result.returncode == 0, 'OpenSSL ES256 signing failed')
    finally:
        os.close(fd)
    signature = result.stdout
    require(len(signature) >= 8 and signature[0] == 0x30 and signature[1] == len(signature)-2,
            'Unexpected ECDSA DER sequence')
    offset, values = 2, []
    for _ in range(2):
        require(signature[offset] == 2, 'Unexpected ECDSA DER integer')
        length = signature[offset+1]
        values.append(int.from_bytes(signature[offset+2:offset+2+length], 'big').to_bytes(32, 'big'))
        offset += 2 + length
    require(offset == len(signature), 'Unexpected ECDSA DER trailer')
    return message + '.' + base64.urlsafe_b64encode(b''.join(values)).decode().rstrip('=')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cleanup', action='store_true', help='Workflow fallback for this run only')
    args = parser.parse_args()
    if args.cleanup:
        if MARKER.exists():
            state = json.loads(MARKER.read_text())
            cleanup(Path(state['base']), state['project'])
        else:
            print('Cleanup: no owned stack remains')
        return
    require(not MARKER.exists(), 'Previous owned stack marker exists; refusing to reuse')
    require(run(['supabase', '--version']) == CLI_VERSION, 'Unexpected CLI version')
    print(f'Supabase CLI {CLI_VERSION}', flush=True)
    # Discover supported flags on the installed pinned CLI, without emitting status secrets.
    for command in ([], ['start'], ['stop'], ['status'], ['db', 'advisors']):
        run(['supabase'] + command + ['--help'])
    run(DOCKER + ['info', '--format', '{{.ServerVersion}}'])
    # Fail before start if any requested host port is already in use. Never stop its owner.
    for port in (56320, 56321, 56322):
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', port))
    project = 'ai-usage-http-' + secrets.token_hex(8)
    base = Path(tempfile.gettempdir()) / project
    base.mkdir(mode=0o700)
    (base / 'supabase').mkdir(mode=0o700)
    template = (ROOT / '06-supabase.config.toml').read_text()
    (base / 'supabase/config.toml').write_text(template.replace('PROJECT_ID', project))
    MARKER.write_text(json.dumps({'base': str(base), 'project': project}))
    MARKER.chmod(0o600)
    cli = ['supabase', '--workdir', str(base)]
    db = 'supabase_db_' + project
    users = []
    applied = False

    def terminate(signum, frame):
        raise SystemExit(f'Interrupted by signal {signum}')

    signal.signal(signal.SIGTERM, terminate)
    signal.signal(signal.SIGINT, terminate)

    def sql(statement):
        # Separate admin channel: Unix socket INSIDE exactly our own DB container.
        return run(DOCKER + ['exec', '-i', db, 'psql', '-XqAt', '-U', 'postgres',
                             '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], data=statement)

    def request(method, path, token=None, body=None, profile=None, admin=False):
        require(path.startswith(('/auth/v1/', '/rest/v1/')) and not path.startswith('//'),
                'Unexpected API path')
        # Literal loopback + fixed owned port; no proxy, DNS, external URL, redirect following.
        conn = http.client.HTTPConnection('127.0.0.1', 56321, timeout=20)
        headers = {'apikey': service if admin else anon, 'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        if profile:
            headers['Accept-Profile' if method == 'GET' else 'Content-Profile'] = profile
        try:
            conn.request(method, path, body=None if body is None else json.dumps(body), headers=headers)
            response = conn.getresponse()
            raw = response.read()
            require(not 300 <= response.status < 400, 'API redirect refused')
            return response.status, json.loads(raw) if raw else None
        finally:
            conn.close()

    try:
        run(cli + ['start', '-x', 'studio,postgres-meta,realtime,storage-api,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor'], timeout=600)
        for component in ('db', 'auth', 'rest', 'kong'):
            info = inspect(f'supabase_{component}_{project}')
            require(info['Config']['Labels'].get('com.supabase.cli.project') == project,
                    'Container ownership mismatch')
            require(info['State']['Running'], 'Required service not running')
            print(f"Service {component}: {info['Config']['Image']} ({info['Image']})", flush=True)
        status = json.loads(run(cli + ['status', '-o', 'json']))
        require(status['API_URL'] == 'http://127.0.0.1:56321', 'Unexpected API origin')
        anon, service = status['ANON_KEY'], status['SERVICE_ROLE_KEY']
        auth_env = dict(item.split('=', 1) for item in inspect('supabase_auth_' + project)['Config']['Env'])
        signing_keys = json.loads(auth_env['GOTRUE_JWT_KEYS'])
        rest_env = dict(item.split('=', 1) for item in inspect('supabase_rest_' + project)['Config']['Env'])
        require(rest_env['PGRST_DB_SCHEMAS'] == 'public', 'Unexpected exposed schemas')
        print('DB version: ' + sql('show server_version;'), flush=True)
        print('Exposed schemas: public only; real Auth/auth.uid, no fixture', flush=True)
        # Observe Supabase-specific default ACLs/event triggers, never change them to pass.
        print('Default ACL catalog: ' + sql("SELECT coalesce(json_agg(row_to_json(x)), '[]') FROM (SELECT defaclrole::regrole::text, defaclnamespace::regnamespace::text, defaclobjtype, defaclacl::text FROM pg_default_acl ORDER BY 1,2,3) x;"), flush=True)
        print('Event triggers: ' + sql("SELECT coalesce(json_agg(row_to_json(x)), '[]') FROM (SELECT evtname, evtevent, evtenabled FROM pg_event_trigger ORDER BY evtname) x;"), flush=True)
        sql((ROOT / '01-setup.proposed.sql').read_text())
        applied = True
        sql((ROOT / '02-verify.readonly.sql').read_text())
        # Official PostgREST notification, local DB only. Poll metadata, never retry a reservation.
        sql("NOTIFY pgrst, 'reload schema';")

        def new_user():
            email = secrets.token_hex(12) + '@example.test'
            password = secrets.token_urlsafe(32)
            code, created = request('POST', '/auth/v1/admin/users', service,
                                    {'email': email, 'password': password, 'email_confirm': True}, admin=True)
            require(code in (200, 201), 'Auth admin create failed')
            uid = str(uuid.UUID(created['id']))
            users.append(uid)
            code, session = request('POST', '/auth/v1/token?grant_type=password',
                                    body={'email': email, 'password': password})
            require(code == 200, 'Regular Auth password login failed')
            token = session['access_token']
            header, claims = decode(token.split('.')[0]), decode(token.split('.')[1])
            require(header['alg'] == 'ES256' and claims['sub'] == uid and claims['role'] == 'authenticated',
                    'Unexpected Auth JWT contract')
            return uid, token

        a, at = new_user()
        b, bt = new_user()
        for _ in range(100):
            code, metadata = request('GET', '/rest/v1/', at)
            if code == 200 and '/rpc/reserve_ai_usage' in metadata.get('paths', {}):
                break
            time.sleep(0.1)
        else:
            raise RuntimeError('RPC schema cache did not become ready')

        print('PASS regular Auth login A/B; JWT ES256 (Auth-issued P-256 signing key)', flush=True)

        def snapshot():
            return sql("SELECT coalesce(json_agg(row_to_json(u) ORDER BY user_id), '[]') FROM ai_usage_private.usage u;")

        def state(uid):
            result = sql(f"SELECT row_to_json(u) FROM ai_usage_private.usage u WHERE user_id = '{uid}'::uuid;")
            return json.loads(result) if result else None

        def contract(row):
            require(set(row) == {'allowed', 'reason', 'daily_remaining', 'minute_remaining', 'retry_at'}, 'RPC columns')
            require(type(row['allowed']) is bool and type(row['reason']) is str and
                    type(row['daily_remaining']) is int and type(row['minute_remaining']) is int, 'RPC types')
            require(0 <= row['daily_remaining'] <= 20 and 0 <= row['minute_remaining'] <= 3, 'RPC remaining range')
            if row['allowed']:
                require(row['reason'] == 'allowed' and row['retry_at'] is None, 'Allowed contract')
            else:
                require(row['reason'] in ('minute_limit', 'daily_limit', 'daily_and_minute_limit'), 'Rejected reason')
                require(type(row['retry_at']) is str, 'retry_at type')
                require(datetime.fromisoformat(row['retry_at']).tzinfo is not None, 'retry_at timezone')

        def reserve(token):
            code, rows = request('POST', '/rest/v1/rpc/reserve_ai_usage', token, {})
            require(code == 200 and type(rows) is list and len(rows) == 1, 'RPC status/row count')
            contract(rows[0])
            return rows[0]

        for count in range(1, 4):
            row = reserve(at)
            require(row == dict(allowed=True, reason='allowed', daily_remaining=20-count,
                                minute_remaining=3-count, retry_at=None), 'Sequential response')
            actual = state(a)
            require(actual['daily_count'] == count and len(actual['recent']) == count and state(b) is None,
                    'auth.uid isolation/state mismatch')
        before = snapshot()
        row = reserve(at)
        require(row['reason'] == 'minute_limit' and not row['allowed'] and
                row['daily_remaining'] == 17 and row['minute_remaining'] == 0, 'Fourth request not limited')
        expected_retry = datetime.fromisoformat(state(a)['recent'][0]).timestamp() + 60
        require(abs(datetime.fromisoformat(row['retry_at']).timestamp() - expected_retry) < 0.001,
                'retry_at differs from DB window')
        require(snapshot() == before, 'Limit rejection changed state')
        require(reserve(bt)['daily_remaining'] == 19 and state(b)['daily_count'] == 1 and
                state(a)['daily_count'] == 3, 'B independent budget')
        print('PASS HTTP RPC contract, real auth.uid, A/B isolation, fourth request rejection and DB agreement', flush=True)

        # Admin-only preparation of day-limit states, never a caller RPC override.
        e, et = new_user()
        sql(f"INSERT INTO ai_usage_private.usage VALUES ('{e}', (clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date, 20, '{{}}');")
        for reason in ('daily_limit', 'daily_and_minute_limit'):
            if reason == 'daily_and_minute_limit':
                sql(f"UPDATE ai_usage_private.usage SET recent = array_fill(clock_timestamp(), ARRAY[3]) WHERE user_id = '{e}';")
            before = snapshot()
            row = reserve(et)
            require(not row['allowed'] and row['reason'] == reason and row['daily_remaining'] == 0, 'Day limit contract')
            expected = float(sql("SELECT extract(epoch FROM (((clock_timestamp() AT TIME ZONE 'Asia/Tokyo')::date + 1)::timestamp AT TIME ZONE 'Asia/Tokyo'));"))
            if reason == 'daily_and_minute_limit':
                expected = max(expected, datetime.fromisoformat(state(e)['recent'][0]).timestamp() + 60)
            require(abs(datetime.fromisoformat(row['retry_at']).timestamp() - expected) < 0.001 and snapshot() == before, 'Day limit retry/state')
        print('PASS HTTP daily/both limit reasons and retry_at, admin preparation separated', flush=True)

        c, ct = new_user()
        barrier = threading.Barrier(12)

        def worker():
            barrier.wait(timeout=10)
            return reserve(ct)

        with ThreadPoolExecutor(max_workers=12) as pool:
            rows = list(pool.map(lambda _: worker(), range(12)))
        require(sum(row['allowed'] for row in rows) == 3, 'Concurrent allowed count')
        require(sorted(row['daily_remaining'] for row in rows if row['allowed']) == [17, 18, 19], 'Concurrent remaining')
        require(all(row['reason'] == 'minute_limit' and row['daily_remaining'] == 17 and
                    row['minute_remaining'] == 0 for row in rows if not row['allowed']), 'Concurrent rejection contract')
        require(state(c)['daily_count'] == 3 and len(state(c)['recent']) == 3, 'Concurrent DB state')
        print('PASS 12 simultaneous HTTP requests: exactly 3 allowed; response/DB agreement', flush=True)

        def denied(name, token, body=None, method='POST', path='/rest/v1/rpc/reserve_ai_usage', profile=None,
                   statuses=(400, 401, 403, 404, 406)):
            before = snapshot()
            code, response = request(method, path, token, {} if body is None and method == 'POST' else body, profile)
            require(code in statuses, f'{name}: unexpected HTTP status {code}')
            require(snapshot() == before, f'{name}: rejection changed usage')
            # Print only status and sanitized known server code; never payload or JWT.
            error = response.get('code', '') if isinstance(response, dict) else ''
            require(re.fullmatch(r'[A-Za-z0-9_]*', error) is not None, 'Unexpected error code format')
            print(f'PASS rejection {name}: HTTP {code} {error}; all usage unchanged', flush=True)
            return response

        denied('public API key only', None, statuses=(401, 403))
        denied('malformed JWT', 'invalid.jwt', statuses=(401,))
        parts = at.split('.')
        claims = decode(parts[1])
        damaged = bytearray(unbase64(parts[2]))
        damaged[0] ^= 1  # Preserve signature encoding and length; change only signature bytes.
        wrong_signature = base64.urlsafe_b64encode(damaged).decode().rstrip('=')
        denied('wrong signature', '.'.join(parts[:2] + [wrong_signature]), statuses=(401,))
        changed = dict(claims, sub=b)
        denied('A sub tampered to B', '.'.join([parts[0], encode(changed), parts[2]]), statuses=(401,))

        # Positive signature control on a fresh user; same key/claims, only time differs.
        d, dt = new_user()
        dheader, dclaims = (decode(part) for part in dt.split('.')[:2])
        key = next(key for key in signing_keys if key['kid'] == dheader['kid'])
        code, jwks = request('GET', '/auth/v1/.well-known/jwks.json')
        require(code == 200 and any(k['kid'] == key['kid'] and k['x'] == key['x'] and k['y'] == key['y']
                                   for k in jwks['keys']), 'Auth JWKS key mismatch')

        def signed(payload):
            return sign_es256(dheader, payload, key)

        require(reserve(signed(dclaims))['allowed'] and state(d)['daily_count'] == 1,
                'Local signing positive control failed')
        expired = dict(dclaims, exp=int(time.time()) - 120, iat=int(time.time()) - 7200)
        error = denied('correctly signed expired JWT', signed(expired), statuses=(401,))
        require('expired' in error.get('message', '').lower(), 'Expiration was not rejection reason')
        print('PASS expired JWT: correct local ES256 signature, positive control accepted, exp 120s in past', flush=True)
        for body in ({'user_id': b}, {'daily_limit': 999}, {'user_id': b, 'minute_limit': 999}):
            denied('extra RPC arguments', at, body, statuses=(404,))
        for token_name, token in (('authenticated', at), ('anon', None)):
            for method in ('GET', 'PATCH', 'DELETE'):
                for profile in (None, 'ai_usage_private'):
                    denied(f'{token_name} direct table {method} profile={profile}', token,
                           {'daily_count': 0} if method == 'PATCH' else None, method,
                           '/rest/v1/usage?user_id=eq.' + a, profile, statuses=(404, 406))
            denied(f'{token_name} internal function public profile', token, path='/rest/v1/rpc/reserve', statuses=(404,))
            denied(f'{token_name} internal function private profile', token, path='/rest/v1/rpc/reserve',
                   profile='ai_usage_private', statuses=(406,))
        sql((ROOT / '02-verify.readonly.sql').read_text())
        print('PASS catalog: dedicated owner, FORCE RLS, membership and function/table ACLs under real Supabase defaults', flush=True)
        # Local advisors supported by this pinned CLI; output captured, only counts retained.
        raw_advisor = run(cli + ['db', 'advisors', '--local', '--type', 'all', '--level', 'info', '-o', 'json'])
        advisor = json.loads(raw_advisor) if raw_advisor else []
        require(isinstance(advisor, list), 'Unexpected advisor result')
        for finding in advisor:
            name, level = finding['name'], finding['level']
            require(re.fullmatch(r'[a-z0-9_]+', name) and level in ('INFO', 'WARN', 'ERROR'), 'Advisor format')
            print(f'Advisor: {level} {name}', flush=True)
        require(not any(f['level'] == 'ERROR' for f in advisor), 'Local Advisor error finding')
        print(f'PASS local Advisors executed: {len(advisor)} findings; metadata/details omitted', flush=True)
    finally:
        # Individual deletion/rollback give explicit evidence; container disposal remains mandatory on any error.
        try:
            if applied:
                for uid in users:
                    code, _ = request('DELETE', '/auth/v1/admin/users/' + uid, service, admin=True)
                    require(code in (200, 204), 'Auth cleanup failed')
                require(sql('SELECT count(*) FROM ai_usage_private.usage;') == '0', 'User cleanup cascade failed')
                sql((ROOT / '05-rollback.proposed.sql').read_text())
                require(sql("SELECT to_regnamespace('ai_usage_private') IS NULL AND to_regprocedure('public.reserve_ai_usage()') IS NULL AND NOT EXISTS (SELECT FROM pg_roles WHERE rolname='ai_usage_limit_owner');") == 't', 'Rollback cleanup failed')
                print('PASS cleanup: Auth users deleted, usage cascade, SQL objects/role removed', flush=True)
        finally:
            cleanup(base, project)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        # Do not print exception values from third-party JSON/HTTP/subprocess operations.
        if isinstance(error, RuntimeError):
            print('FAIL: ' + str(error), flush=True)
        else:
            print('FAIL: ' + type(error).__name__ + ' (details suppressed to protect credentials)', flush=True)
        raise SystemExit(1)
