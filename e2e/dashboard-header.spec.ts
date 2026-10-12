import { expect, test, type Locator, type Page } from "@playwright/test";
import { loginToDashboard, stubExternalServices } from "./support/supabaseMock";

async function expectHeaderLayout(page: Page, user: Locator) {
  const header = page.locator("header");
  const content = page.locator("#main-content");
  await expect(user).toBeVisible();
  await expect(header.getByRole("link", { name: "プライバシーとデータ" })).toHaveAttribute("href", "/privacy");
  await expect(header.getByRole("button", { name: "👋 ログアウト" })).toBeVisible();
  await expect(page.getByRole("button", { name: "データを書き出す" })).toHaveCount(0);
  await expect(page.getByText("Supabaseへ保存済みのデータのみ")).toHaveCount(0);
  await expect.poll(async () => {
    const [headerBox, contentBox, userBox] = await Promise.all([
      header.boundingBox(), content.boundingBox(), user.boundingBox(),
    ]);
    if (!headerBox || !contentBox || !userBox) return false;
    return headerBox.y + headerBox.height + 16 <= contentBox.y &&
      userBox.y >= headerBox.y && userBox.y + userBox.height <= headerBox.y + headerBox.height &&
      userBox.x >= headerBox.x && userBox.x + userBox.width <= headerBox.x + headerBox.width;
  }).toBe(true);
  await expect.poll(() => header.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const controls = header.locator("a, button");
  const boxes = await controls.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  const width = page.viewportSize()!.width;
  for (const [index, box] of boxes.entries()) {
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(width);
    for (const other of boxes.slice(index + 1)) {
      expect(box.right <= other.left || other.right <= box.left ||
        box.bottom <= other.top || other.bottom <= box.top).toBe(true);
    }
  }
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth &&
    document.body.scrollWidth <= document.body.clientWidth,
  )).toBe(true);
}

for (const width of [320, 1280]) {
  for (const enlargedText of [false, true]) {
    test(`${width}x720・文字拡大${enlargedText}で長いユーザー名と本文が重ならない`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await stubExternalServices(page);
      const mock = await loginToDashboard(page);
      const name = "long-user-name-".repeat(20);
      await mock.changeAuthUser(name);
      const user = page.locator("header").getByText(`${name} さん🌷`, { exact: true });
      await expect(user).toBeVisible();
      if (enlargedText) {
        await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      }
      await expectHeaderLayout(page, user);
      await page.screenshot({ path: `/tmp/dashboard-header-${width}-${enlargedText ? "200" : "100"}.png`, fullPage: true });
      const privacy = page.getByRole("link", { name: "プライバシーとデータ" });
      await privacy.focus();
      await page.keyboard.press("Tab");
      const logout = page.getByRole("button", { name: "👋 ログアウト" });
      await expect(logout).toBeFocused();
      await expect(logout).toHaveCSS("outline-style", "solid");
      await page.getByRole("button", { name: "🕊️ 鳥の目線になる" }).click();
      await expect(page.getByRole("button", { name: "🌱 地上に戻る" })).toHaveAttribute("aria-pressed", "true");
      const bird = page.getByRole("heading", { name: "🕊️ 空からの景色" });
      await expect(bird).toBeVisible();
      await expect.poll(async () => {
        const [headerBox, birdBox] = await Promise.all([page.locator("header").boundingBox(), bird.boundingBox()]);
        return Boolean(headerBox && birdBox && headerBox.y + headerBox.height < birdBox.y);
      }).toBe(true);
      await page.getByRole("button", { name: "🌱 地上に戻る" }).click();
      await expectHeaderLayout(page, user);
      for (const tab of ["ワーク", "お守り", "ホーム"]) {
        await page.getByRole("tab", { name: tab, exact: true }).click();
        await expectHeaderLayout(page, user);
      }
    });
  }
}
