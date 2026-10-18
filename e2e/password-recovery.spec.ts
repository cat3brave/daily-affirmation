import { expect, test } from "@playwright/test";
import { stubPasswordRecoverySupabase } from "./support/supabaseMock";

const external: string[] = [];
test.beforeEach(async ({ context }) => {
  external.length = 0;
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (["http://127.0.0.1:3100", "http://127.0.0.1:54321"].includes(url.origin)) return route.fallback();
    external.push(url.origin); await route.abort();
  });
});
test.afterEach(() => { expect(external).toEqual([]); });

test("復旧依頼からサーバーのPKCE交換、更新とログアウトまで完了する", async ({ page, request }) => {
  const mock = await stubPasswordRecoverySupabase(page);
  await page.goto("/login");
  await page.getByRole("link", { name: "パスワードを忘れた方" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole("heading", { name: "パスワードの復旧", exact: true })).toBeVisible();
  await page.getByLabel("メールアドレス").fill("  e2e-user@example.com  ");
  await expect(page.getByLabel("メールアドレス")).toHaveValue(/e2e-user@example\.com/);
  await page.getByRole("button", { name: "復旧メールを依頼する" }).click();
  await expect(page.getByRole("status")).toContainText("登録されているメールアドレスの場合");
  expect(mock.recoveries).toHaveLength(1);
  expect(mock.recoveries[0].email).toBe("e2e-user@example.com");
  expect(mock.recoveries[0].code_challenge_method).toBe("s256");
  const challenge = mock.recoveries[0].code_challenge;
  expect(challenge).toMatch(/^[\w-]+$/);
  // This test link replaces email delivery; the callback and Cookie adapter are real.
  const callbackResponse = page.waitForResponse((response) => new URL(response.url()).pathname === "/auth/recovery");
  await page.goto(`/auth/recovery?code=e2e-recovery-${challenge}&next=https://example.invalid`);
  expect((await callbackResponse).headers()["cache-control"]).toContain("no-store");
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.getByRole("button", { name: "パスワードを更新する" })).toBeEnabled();
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const password = "  new e2e-password 日本語  ";
  await page.getByLabel("新しいパスワード", { exact: true }).fill(password);
  await page.getByLabel("新しいパスワード（確認）").fill(password);
  await page.getByRole("button", { name: "パスワードを更新する" }).click();
  await expect(page.getByRole("status")).toContainText("このブラウザーからログアウトしました");
  expect(mock.passwords).toEqual([password]);
  await page.getByRole("button", { name: "ログイン画面へ戻る" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/dashboard", { maxRedirects: 0 })).status()).toBe(307);
  const audit = await (await request.get("http://127.0.0.1:54321/__requests")).json();
  expect(audit.requests).toContainEqual(expect.objectContaining({ source: "server", method: "POST", path: "/auth/v1/token", query: "?grant_type=pkce" }));
  expect(audit.unexpected).toEqual([]); expect(external).toEqual([]);
});

test("無効・Cookie消失リンクは再依頼でき、既存セッションでも交換失敗を成功にしない", async ({ page, context }) => {
  const mock = await stubPasswordRecoverySupabase(page);
  for (const path of ["/auth/recovery?code=e2e-recovery-missing-cookie", "/auth/recovery", "/auth/recovery?code=used-code"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/reset-password\/invalid$/);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("もう一度依頼");
  }
  const session = { access_token: "e2e-access-token", refresh_token: "e2e-refresh-token", expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer", user: { id: "e2e-user-id" } };
  await context.addCookies([{ name: "sb-127-auth-token", value: "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"), url: "http://127.0.0.1:3100" }]);
  await page.goto("/auth/recovery?code=expired-code&next=//example.invalid");
  await expect(page).toHaveURL(/\/reset-password\/invalid$/);
  await page.getByRole("link", { name: "復旧メールを再依頼する" }).click();
  await page.getByLabel("メールアドレス").fill("e2e-user@example.com");
  await page.getByRole("button", { name: "復旧メールを依頼する" }).click();
  await expect(page.getByRole("status")).toContainText("登録されているメールアドレスの場合");
  expect(mock.recoveries).toHaveLength(1); expect(mock.passwords).toEqual([]);
});
