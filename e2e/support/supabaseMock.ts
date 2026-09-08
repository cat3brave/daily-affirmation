import { expect, type Page } from "@playwright/test";

const supabaseAuthRequestUrlPattern =
  /^https:\/\/example\.supabase\.co\/auth\/v1\//;
const e2eUser = {
  id: "e2e-user-id",
  aud: "authenticated",
  role: "authenticated",
  email: "e2e-user@example.com",
  email_confirmed_at: "2026-08-13T00:00:00.000Z",
  phone: "",
  confirmed_at: "2026-08-13T00:00:00.000Z",
  last_sign_in_at: "2026-08-13T00:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: "2026-08-13T00:00:00.000Z",
  updated_at: "2026-08-13T00:00:00.000Z",
};
const e2eSessionResponse = {
  access_token: "e2e-access-token",
  token_type: "bearer",
  expires_in: 3600,
  refresh_token: "e2e-refresh-token",
  user: e2eUser,
};
const allowedDashboardRestTables = new Set([
  "bloom_logs",
  "favorite_affirmations",
  "three_good_things",
]);

type LoginRequestBody = { email?: unknown; password?: unknown };

export type AuthenticatedSupabaseMock = {
  loginRequestBodies: LoginRequestBody[];
  restWriteRequests: string[];
  unexpectedAuthRequests: string[];
  unexpectedRestRequests: string[];
};

export async function stubExternalServices(page: Page) {
  await page.route("https://example.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.startsWith("/auth/v1/user")) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Missing session" }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.route("https://generativelanguage.googleapis.com/**", (route) => route.abort());
  await page.route("https://accounts.google.com/**", (route) => route.abort());
}

export async function stubAuthenticatedSupabase(
  page: Page,
): Promise<AuthenticatedSupabaseMock> {
  const mockState: AuthenticatedSupabaseMock = {
    loginRequestBodies: [],
    restWriteRequests: [],
    unexpectedAuthRequests: [],
    unexpectedRestRequests: [],
  };

  await page.route("https://example.supabase.co/auth/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (
      request.method() === "POST" &&
      url.pathname === "/auth/v1/token" &&
      url.searchParams.get("grant_type") === "password"
    ) {
      mockState.loginRequestBodies.push(request.postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...e2eSessionResponse,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      });
      return;
    }

    if (request.method() === "GET" && url.pathname === "/auth/v1/user") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(e2eUser),
      });
      return;
    }

    mockState.unexpectedAuthRequests.push(`${request.method()} ${url.href}`);
    await route.abort();
  });

  await page.route("https://example.supabase.co/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const table = url.pathname.replace("/rest/v1/", "").split("/")[0];

    if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
      mockState.restWriteRequests.push(`${method} ${url.href}`);
      await route.abort();
      return;
    }
    if (!["GET", "HEAD"].includes(method) || !allowedDashboardRestTables.has(table)) {
      mockState.unexpectedRestRequests.push(`${method} ${url.href}`);
      await route.abort();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "content-range": method === "HEAD" ? "0-0/0" : "*/0" },
      body: method === "HEAD" ? "" : "[]",
    });
  });

  return mockState;
}

export function trackSupabaseAuthRequests(page: Page) {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (supabaseAuthRequestUrlPattern.test(request.url())) requests.push(request.url());
  });
  return requests;
}

export async function loginToDashboard(page: Page) {
  const supabaseMock = await stubAuthenticatedSupabase(page);
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill("e2e-user@example.com");
  await page.getByLabel("パスワード").fill("e2e-password");
  const appOrigin = new URL(page.url()).origin;
  const loginResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === "POST" && url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "password";
  });
  const dashboardResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.origin === appOrigin && url.pathname === "/dashboard";
  });
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  expect((await loginResponsePromise).ok()).toBe(true);
  expect((await dashboardResponsePromise).ok()).toBe(true);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("ログイン情報を確認しています...")).toBeHidden();
  return supabaseMock;
}

export function expectSafeAuthenticatedRequests(mock: AuthenticatedSupabaseMock) {
  expect(mock.loginRequestBodies).toEqual([
    { email: "e2e-user@example.com", password: "e2e-password", gotrue_meta_security: {} },
  ]);
  expect(mock.restWriteRequests).toEqual([]);
  expect(mock.unexpectedAuthRequests).toEqual([]);
  expect(mock.unexpectedRestRequests).toEqual([]);
}
