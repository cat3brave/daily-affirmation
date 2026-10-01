import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { stubExternalServices } from "./support/supabaseMock";

test.beforeEach(async ({ page }) => { await stubExternalServices(page); });

test("未認証でプライバシーセンターを表示し、説明とリンクを利用できる", async ({ page }) => {
  const response = await page.goto("/privacy");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("プライバシーとデータ");
  await expect(page.getByText(/Supabaseへ保存するデータ/)).toBeVisible();
  await expect(page.getByText(/localStorageへ、ユーザー別/)).toBeVisible();
  await expect(page.getByText(/Gemini APIへ送信/)).toBeVisible();
  await expect(page.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute("href", "/login");
  await page.getByRole("link", { name: "ダッシュボードへ" }).focus();
  await expect(page.getByRole("link", { name: "ダッシュボードへ" })).toHaveCSS("outline-style", "solid");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

for (const viewport of [{ width: 320, height: 720 }, { width: 1280, height: 720 }]) {
  test(`${viewport.width}x${viewport.height}でプライバシーページがリフローする`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/privacy");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}
