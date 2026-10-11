import { spawn } from "node:child_process";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const playwright = join(root, "node_modules/@playwright/test/cli.js");
const children = new Set();
let workspace;
let stopping = false;

// Allow only OS necessities. Never inherit application credentials or NODE_OPTIONS.
const env = {};
for (const [name, value] of Object.entries(process.env)) {
  if (/^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|LOCALAPPDATA|APPDATA|CI|PLAYWRIGHT_BROWSERS_PATH)$/i.test(name)) {
    env[name] = value;
  }
}
Object.assign(env, {
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-placeholder-anon-key",
  GEMINI_API_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  ACCOUNT_DELETION_ENABLED: "false",
  ACCOUNT_DELETION_DB_VERIFIED: "false",
  ACCOUNT_DELETION_EMAIL_OTP_VERIFIED: "false",
  ACCOUNT_DELETION_ORIGIN: "",
  E2E_EXPORT_FIXED_TIME: "",
  E2E_PROD_MOCK: "true",
  E2E_PROD_READY: "true",
});

function start(script, args, cwd, childEnv = env) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd, env: childEnv, stdio: "inherit", detached: process.platform !== "win32",
  });
  children.add(child);
  child.completion = new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      children.delete(child);
      resolveExit(code ?? (signal ? 1 : 0));
    });
  });
  return child;
}

async function assertFree(port) {
  await new Promise((resolveFree, reject) => {
    const probe = createServer();
    probe.once("error", () => reject(new Error(`Port ${port} is occupied; refusing to reuse a server.`)));
    probe.listen(port, "127.0.0.1", () => probe.close(resolveFree));
  });
}

async function ready(url, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (!children.has(child)) throw new Error("Server exited before readiness.");
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1000) })).ok) return;
    } catch { /* Server has not bound its port yet. */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error("Server readiness timed out.");
}

async function cleanup() {
  if (stopping) return;
  stopping = true;
  await Promise.all([...children].map(async (child) => {
    if (process.platform === "win32") {
      await new Promise((done) => {
        const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        killer.once("error", done);
        killer.once("exit", done);
      });
    } else {
      try { process.kill(-child.pid, "SIGTERM"); } catch { /* Already exited. */ }
      const timer = setTimeout(() => {
        try { process.kill(-child.pid, "SIGKILL"); } catch { /* Already exited. */ }
      }, 5000);
      await child.completion;
      clearTimeout(timer);
    }
  }));
  if (workspace) await rm(workspace, { recursive: true, force: true });
}

for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143]]) {
  process.on(signal, async () => { await cleanup(); process.exit(code); });
}

try {
  await assertFree(3200);
  await assertFree(54321);
  workspace = await mkdtemp(join(tmpdir(), "daily-affirmation-prod-"));
  // Explicit source allowlist: no .env files, stale .next output or local secrets.
  for (const name of ["app", "public", "proxy.ts", "next.config.ts", "tsconfig.json", "postcss.config.mjs", "package.json", "vitest.setup.ts", "vitest.config.mts", "proxy.test.ts", "playwright.config.ts", "playwright.prod.config.ts", "e2e", "e2e-prod"]) {
    await cp(join(root, name), join(workspace, name), { recursive: true });
  }
  await cp(join(root, "node_modules"), join(workspace, "node_modules"), { recursive: true });
  const next = join(workspace, "node_modules/next/dist/bin/next");
  // Build-time font downloads use the managed network/CA configuration only.
  const buildEnv = { ...env };
  for (const name of ["HTTP_PROXY", "HTTPS_PROXY", "NO_PROXY", "http_proxy", "https_proxy", "no_proxy", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE"]) {
    if (process.env[name]) buildEnv[name] = process.env[name];
  }
  const buildCode = await start(next, ["build", workspace], workspace, buildEnv).completion;
  if (buildCode !== 0) throw new Error(`Production build failed (exit ${buildCode}).`);
  const mock = start(join(root, "e2e/support/supabaseServerMock.mjs"), [], root);
  await ready("http://127.0.0.1:54321/health", mock);
  const app = start(next, ["start", workspace, "--hostname", "127.0.0.1", "--port", "3200"], workspace);
  await ready("http://127.0.0.1:3200/login", app);
  const tests = start(playwright, ["test", "--config", "playwright.prod.config.ts"], root);
  // An unexpected server exit must fail the run even if tests could otherwise pass.
  process.exitCode = await Promise.race([
    tests.completion,
    app.completion.then(() => { throw new Error("App exited during tests."); }),
    mock.completion.then(() => { throw new Error("Mock exited during tests."); }),
  ]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await cleanup();
}
