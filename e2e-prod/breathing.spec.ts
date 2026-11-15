import { expect, test } from "@playwright/test";
import { checkBreathingRestart } from "../e2e/support/breathing";

for (const width of [320, 1280]) {
for (const fontSize of (width === 320 ? [100, 200] : [100])) {
for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`本番ビルドの深呼吸を1操作で再開し停止できる (${width}px・文字${fontSize}%・${reducedMotion})`, async ({ page }, testInfo) => {
    const externalRequests: string[] = [];
    await page.context().route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (["http://127.0.0.1:3200", "http://127.0.0.1:54321"].includes(url.origin)) return route.continue();
      externalRequests.push(url.origin);
      await route.abort();
    });
    await page.setViewportSize({ width, height: 720 });
    await page.emulateMedia({ reducedMotion });
    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill("e2e-user@example.com");
    await page.getByLabel("パスワード").fill("e2e-password");
    await page.getByRole("button", { name: "ログイン", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.evaluate(size => { document.documentElement.style.fontSize = `${size}%`; }, fontSize);
    await checkBreathingRestart(page, testInfo);
    expect(externalRequests).toEqual([]);
    const audit = await page.request.get("http://127.0.0.1:54321/__requests");
    expect(audit.ok()).toBe(true);
    expect((await audit.json()).unexpected).toEqual([]);
  });
}
}
}
