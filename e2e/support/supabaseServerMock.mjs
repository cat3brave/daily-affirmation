import { createServer } from "node:http";

// Test-only HTTP service: never forwards requests to Supabase or another host.
const user = {
  id: "e2e-user-id", email: "e2e-user@example.com", aud: "authenticated",
  role: "authenticated", app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {}, created_at: "2026-08-13T00:00:00.000Z",
};
const exportRows = {
  todos: [
    { id: "todo-e2e", user_id: user.id, text: "深呼吸する", completed: true, created_at: "2026-09-18T00:00:00.000Z" },
    { id: "todo-other", user_id: "other-user", text: "他ユーザーの秘密", completed: false, created_at: "2026-09-17T00:00:00.000Z" },
  ],
  favorite_affirmations: [
    { id: "favorite-e2e", user_id: user.id, text: "今日も一歩ずつ", created_at: "2026-09-20T00:00:00.000Z" },
    { id: "favorite-other", user_id: "other-user", text: "他ユーザーの秘密", created_at: "2026-09-19T00:00:00.000Z" },
  ],
  three_good_things: [
    { id: "good-other", user_id: "other-user", date: "2026-09-21", things1: "他ユーザーの秘密", things2: "秘密", things3: "秘密", created_at: "2026-09-21T11:00:00.000Z" },
    { id: "good-e2e", user_id: user.id, date: "2026-09-21", things1: "散歩", things2: "青空", things3: "温かいお茶", created_at: "2026-09-21T12:00:00.000Z" },
  ],
  bloom_logs: [
    { id: "bloom-other", user_id: "other-user", flower_type: "secret", created_at: "2026-09-21T00:00:00.000Z" },
    { id: "bloom-e2e", user_id: user.id, flower_type: "tulip", created_at: "2026-09-22T00:00:00.000Z" },
  ],
};
const productionSmoke = process.env.E2E_PROD_MOCK === "true";
const requests = [];
const unexpected = [];
const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Access-Control-Allow-Origin", productionSmoke ? "http://127.0.0.1:3200" : "http://127.0.0.1:3100");
  response.setHeader("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info, x-supabase-api-version");
  response.setHeader("Access-Control-Expose-Headers", "Content-Range");
  response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
  const url = new URL(request.url, "http://127.0.0.1:54321");
  const send = (status, data) => { response.writeHead(status); response.end(JSON.stringify(data)); };
  if (productionSmoke && url.pathname === "/__requests" && request.method === "GET") {
    return send(200, { requests, unexpected });
  }
  if (productionSmoke && !["/health", "/__requests"].includes(url.pathname) && request.method !== "OPTIONS") {
    requests.push({ method: request.method, path: url.pathname, query: url.search, source: request.headers.origin ? "browser" : "server" });
  }
  const rejectUnexpected = () => {
    if (productionSmoke) unexpected.push(`${request.method} ${url.pathname}${url.search}`);
    return send(404, { message: "Unexpected mock request" });
  };
  if (request.method === "OPTIONS") {
    if (productionSmoke && !["/auth/v1/token", "/auth/v1/user", "/auth/v1/logout", ...Object.keys(exportRows).map((table) => `/rest/v1/${table}`)].includes(url.pathname)) {
      return rejectUnexpected();
    }
    return send(204, null);
  }
  if (url.pathname === "/health") return send(200, { ready: true });
  if (url.pathname === "/auth/v1/user" && request.method === "GET") {
    return request.headers.authorization === "Bearer e2e-access-token"
      ? send(200, user)
      : send(401, { code: "bad_jwt", message: "Invalid test session" });
  }
  if (url.pathname === "/auth/v1/logout" && request.method === "POST") {
    if (productionSmoke && request.headers.authorization !== "Bearer e2e-access-token") return send(401, { message: "Unauthorized" });
    return send(204, null);
  }
  if (url.pathname.startsWith("/rest/v1/") && (request.method === "GET" || (productionSmoke && request.method === "HEAD"))) {
    if (request.headers.authorization !== "Bearer e2e-access-token") return send(401, { message: "Unauthorized" });
    const table = url.pathname.slice("/rest/v1/".length);
    if (!(table in exportRows)) return rejectUnexpected();
    const requestedUser = url.searchParams.get("user_id")?.replace(/^eq\./, "");
    if (productionSmoke && (url.searchParams.get("user_id") !== `eq.${user.id}` ||
        [...url.searchParams.keys()].some((key) => !["user_id", "select", "order", "offset", "limit"].includes(key)))) {
      return rejectUnexpected();
    }
    const selected = (url.searchParams.get("select") ?? "").split(",");
    if (productionSmoke && selected.some((column) => column !== "*" && !(column in exportRows[table][0]))) return rejectUnexpected();
    const range = request.headers.range?.match(/(\d+)-(\d+)/);
    const from = Number(range?.[1] ?? url.searchParams.get("offset") ?? 0);
    const to = Number(range?.[2] ?? (from + Number(url.searchParams.get("limit") ?? 1000) - 1));
    const rows = exportRows[table]
      .filter((row) => row.user_id === requestedUser)
      .sort((a, b) => `${a.created_at}:${a.id}`.localeCompare(`${b.created_at}:${b.id}`))
      .slice(from, to + 1)
      .map((row) => Object.fromEntries((selected.includes("*") ? Object.keys(row) : selected).filter((column) => column in row).map((column) => [column, row[column]])));
    response.setHeader("Content-Range", `${from}-${Math.max(from, from + rows.length - 1)}/${rows.length}`);
    return send(200, rows);
  }
  if (url.pathname === "/auth/v1/token" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    let input;
    try { input = JSON.parse(body); } catch { return send(400, { message: "Invalid JSON" }); }
    const grant = url.searchParams.get("grant_type");
    if (productionSmoke && grant === "password" && input.email === user.email && input.password === "e2e-password") {
      return send(200, { access_token: "e2e-access-token", refresh_token: "e2e-refresh-token",
        token_type: "bearer", expires_in: 3600, user });
    }
    if ((grant === "pkce" && input.auth_code === "e2e-oauth-code" && input.code_verifier) ||
        (grant === "refresh_token" && input.refresh_token === "e2e-refresh-token")) {
      return send(200, { access_token: "e2e-access-token", refresh_token: "e2e-refresh-token",
        token_type: "bearer", expires_in: 3600, user });
    }
    return send(400, { code: "invalid_grant", message: "Invalid test grant" });
  }
  return rejectUnexpected();
});
server.listen(54321, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
