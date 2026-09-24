import { createServer } from "node:http";

// Test-only HTTP service: never forwards requests to Supabase or another host.
const user = {
  id: "e2e-user-id", email: "e2e-user@example.com", aud: "authenticated",
  role: "authenticated", app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {}, created_at: "2026-08-13T00:00:00.000Z",
};
const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3100");
  response.setHeader("Access-Control-Allow-Headers", "authorization, apikey, content-type, x-client-info, x-supabase-api-version");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  const url = new URL(request.url, "http://127.0.0.1:54321");
  const send = (status, data) => { response.writeHead(status); response.end(JSON.stringify(data)); };
  if (request.method === "OPTIONS") return send(204, null);
  if (url.pathname === "/health") return send(200, { ready: true });
  if (url.pathname === "/auth/v1/user" && request.method === "GET") {
    return request.headers.authorization === "Bearer e2e-access-token"
      ? send(200, user)
      : send(401, { code: "bad_jwt", message: "Invalid test session" });
  }
  if (url.pathname === "/auth/v1/logout" && request.method === "POST") return send(204, null);
  if (url.pathname === "/auth/v1/token" && request.method === "POST") {
    let body = "";
    for await (const chunk of request) body += chunk;
    let input;
    try { input = JSON.parse(body); } catch { return send(400, { message: "Invalid JSON" }); }
    const grant = url.searchParams.get("grant_type");
    if ((grant === "pkce" && input.auth_code === "e2e-oauth-code" && input.code_verifier) ||
        (grant === "refresh_token" && input.refresh_token === "e2e-refresh-token")) {
      return send(200, { access_token: "e2e-access-token", refresh_token: "e2e-refresh-token",
        token_type: "bearer", expires_in: 3600, user });
    }
    return send(400, { code: "invalid_grant", message: "Invalid test grant" });
  }
  return send(404, { message: "Unexpected mock request" });
});
server.listen(54321, "127.0.0.1");
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close());
