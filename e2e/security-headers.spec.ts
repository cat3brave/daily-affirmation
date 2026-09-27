import { expect, test } from "@playwright/test";
import { loginToDashboard, stubExternalServices } from "./support/supabaseMock";

const expectedSecurityHeaders = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function expectSecurityHeaders(headers: Record<string, string>) {
  for (const [name, value] of Object.entries(expectedSecurityHeaders)) {
    expect(headers[name]).toBe(value);
  }

  const directives = new Set(
    headers["content-security-policy"]
      ?.split(";")
      .map((directive) => directive.trim())
      .filter(Boolean),
  );
  expect(directives).toContain("base-uri 'self'");
  expect(directives).toContain("frame-ancestors 'none'");
  expect(directives).toContain("object-src 'none'");
  expect(headers["x-powered-by"]).toBeUndefined();
}

test.beforeEach(async ({ page }) => {
  await stubExternalServices(page);
});

test("loginの成功レスポンスに基本セキュリティヘッダーを付与する", async ({
  request,
}) => {
  const response = await request.get("/login");

  expect(response.status()).toBe(200);
  expectSecurityHeaders(response.headers());
});

test("未認証dashboardのリダイレクトにも基本セキュリティヘッダーを付与する", async ({
  request,
}) => {
  const response = await request.get("/dashboard", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(new URL(response.headers().location, response.url()).pathname).toBe(
    "/login",
  );
  expectSecurityHeaders(response.headers());
});

test("ログイン、OAuth callback、dashboard保護を維持する", async ({
  context,
  page,
  request,
}) => {
  await loginToDashboard(page);
  await expect(page.getByText("e2e-user さん🌷")).toBeVisible();

  await context.clearCookies();
  const protectedDashboard = await request.get("/dashboard", {
    maxRedirects: 0,
  });
  expect(protectedDashboard.status()).toBe(307);
  expect(
    new URL(
      protectedDashboard.headers().location,
      protectedDashboard.url(),
    ).pathname,
  ).toBe("/login");

  await context.addCookies([
    {
      name: "sb-127-auth-token-code-verifier",
      value:
        "base64-" +
        Buffer.from(JSON.stringify("test-code-verifier")).toString("base64url"),
      url: "http://127.0.0.1:3100",
    },
  ]);
  const callback = await page.request.get(
    "/auth/callback?code=e2e-oauth-code",
    { maxRedirects: 0 },
  );
  expect(callback.status()).toBe(307);
  expect(new URL(callback.headers().location, callback.url()).pathname).toBe("/");

  const dashboard = await page.request.get("/dashboard", { maxRedirects: 0 });
  expect(dashboard.status()).toBe(200);
});
