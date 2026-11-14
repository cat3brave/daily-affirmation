import { expect, test } from "@playwright/test";
import { checkBreathingRestart } from "../e2e/support/breathing";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`本番ビルドの深呼吸を1操作で再開し停止できる (${reducedMotion})`, async ({ page }) => {
    const externalRequests: string[] = [];
    await page.context().route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (["http://127.0.0.1:3200", "http://127.0.0.1:54321"].includes(url.origin)) return route.continue();
      externalRequests.push(url.origin);
      await route.abort();
    });
    await page.emulateMedia({ reducedMotion });
    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill("e2e-user@example.com");
    await page.getByLabel("パスワード").fill("e2e-password");
    await page.getByRole("button", { name: "ログイン", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await checkBreathingRestart(page);
    expect(externalRequests).toEqual([]);
    const audit = await page.request.get("http://127.0.0.1:54321/__requests");
    expect(audit.ok()).toBe(true);
    expect((await audit.json()).unexpected).toEqual([]);
  });
}
