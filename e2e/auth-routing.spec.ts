import { expect, test } from "@playwright/test";
import { loginToDashboard, stubExternalServices } from "./support/supabaseMock";

test.beforeEach(async ({ page }) => { await stubExternalServices(page); });

test("未認証dashboardはJavaScript実行前のHTTPでloginへ戻る", async ({ request }) => {
  for (const path of ["/dashboard", "/dashboard/nested", "/"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(new URL(response.headers().location, response.url()).pathname).toBe("/login");
    expect(await response.text()).not.toContain("デジタル花壇");
  }
});

test("認証後は再読み込みと公開ルートでdashboardを表示し、ログアウト後は保護する", async ({ page }) => {
  await loginToDashboard(page);
  await page.reload();
  await expect(page.getByText("e2e-user さん🌷")).toBeVisible();
  await expect(page.getByText("ログイン情報を確認しています...")).toHaveCount(0);
  for (const path of ["/", "/login"]) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(new URL(response.headers().location, response.url()).pathname).toBe("/dashboard");
  }
  await page.getByRole("button", { name: "👋 ログアウト", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  const response = await page.request.get("/dashboard", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(new URL(response.headers().location, response.url()).pathname).toBe("/login");
});

test("無効Cookieのユーザー情報を信用しない", async ({ request }) => {
  const session = { access_token: "invalid-token", refresh_token: "invalid-refresh", expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: { id: "forged", email: "forged@example.test" } };
  for (const value of ["malformed", "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url")]) {
    const response = await request.get("/dashboard", { maxRedirects: 0, headers: { cookie: "sb-127-auth-token=" + value } });
    expect(response.status()).toBe(307);
    expect(new URL(response.headers().location, response.url()).pathname).toBe("/login");
  }
});

test("OAuth callbackと静的ファイルはproxyの対象外でローカルのcode交換が完了する", async ({ request, context, page }) => {
  expect((await request.get("/google-g.svg")).status()).toBe(200);
  for (const path of ["/auth/callback", "/auth/callback?code=invalid-code"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(new URL(response.headers().location, response.url()).pathname).toBe("/login");
  }
  await context.addCookies([{ name: "sb-127-auth-token-code-verifier", value: "base64-" + Buffer.from(JSON.stringify("test-code-verifier")).toString("base64url"), url: "http://127.0.0.1:3100" }]);
  const response = await page.request.get("/auth/callback?code=e2e-oauth-code", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(new URL(response.headers().location, response.url()).pathname).toBe("/");
  expect(response.headers()["set-cookie"]).toContain("sb-127-auth-token");
  const dashboard = await page.request.get("/dashboard", { maxRedirects: 0 });
  expect(dashboard.status()).toBe(200);
});
