import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  expectSafeAuthenticatedRequests,
  loginToDashboard,
  stubExternalServices,
} from "./support/supabaseMock";

const viewports = [
  { width: 320, height: 720 },
  { width: 1280, height: 720 },
] as const;

async function expectFocusTrapped(page: Page, closeButton: Locator) {
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(closeButton).toBeFocused();
}

async function expectNoHorizontalScroll(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
            document.documentElement.clientWidth &&
          document.body.scrollWidth <= document.body.clientWidth,
      ),
    )
    .toBe(true);
}

async function expectCloseAboveBottomBar(
  closeButton: Locator,
  bottomBarButton: Locator,
) {
  await expect
    .poll(async () => {
      const [closeBox, bottomBarBox] = await Promise.all([
        closeButton.boundingBox(),
        bottomBarButton.boundingBox(),
      ]);
      return Boolean(
        closeBox &&
          bottomBarBox &&
          closeBox.y + closeBox.height <= bottomBarBox.y,
      );
    })
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await stubExternalServices(page);
});

for (const viewport of viewports) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("ホームとお守りから開き、フォーカスを閉じるボタン内に保つ", async ({
      page,
    }) => {
      const supabaseMock = await loginToDashboard(page);
      const homeOpenButton = page.getByRole("button", {
        name: "今日、ちょっと失敗しちゃった...",
      });
      const homeTab = page.getByRole("button", { name: "ホーム", exact: true });
      const amuletTab = page.getByRole("button", { name: "お守り", exact: true });

      await homeOpenButton.click();
      let dialog = page.getByRole("dialog", { name: "Ta-Da!" });
      let closeButton = dialog.getByRole("button", { name: "ありがとう!🌟" });
      await expectFocusTrapped(page, closeButton);
      await expect(page.locator("main > div[inert]")).toHaveCount(1);
      await expect(homeTab).not.toBeFocused();
      await expect
        .poll(() =>
          page.locator("main > div[inert]").evaluate(
            (background) => !background.contains(document.activeElement),
          ),
        )
        .toBe(true);
      await expectCloseAboveBottomBar(closeButton, homeTab);
      await expectNoHorizontalScroll(page);

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(homeOpenButton).toBeFocused();

      await amuletTab.click();
      const amuletOpenButton = page.getByRole("button", {
        name: "今日、失敗しちゃった！",
      });
      await amuletOpenButton.click();
      dialog = page.getByRole("dialog", { name: "Ta-Da!" });
      closeButton = dialog.getByRole("button", { name: "ありがとう!🌟" });
      await expectFocusTrapped(page, closeButton);
      await closeButton.click();
      await expect(dialog).toBeHidden();
      await expect(amuletOpenButton).toBeFocused();

      await amuletOpenButton.click();
      dialog = page.getByRole("dialog", { name: "Ta-Da!" });
      await dialog.locator("..").click({ position: { x: 2, y: 2 } });
      await expect(dialog).toBeHidden();
      await expect(amuletOpenButton).toBeFocused();

      expectSafeAuthenticatedRequests(supabaseMock);
    });

    test("forced-colorsでも境界とフォーカスを識別できる", async ({ page }) => {
      await page.emulateMedia({ forcedColors: "active" });
      const supabaseMock = await loginToDashboard(page);
      await page.getByRole("button", { name: "今日、ちょっと失敗しちゃった..." }).click();
      const dialog = page.getByRole("dialog", { name: "Ta-Da!" });
      const closeButton = dialog.getByRole("button", { name: "ありがとう!🌟" });

      await expectFocusTrapped(page, closeButton);
      await expect
        .poll(() =>
          dialog.evaluate(
            (element) => Number.parseFloat(getComputedStyle(element).borderTopWidth) >= 2,
          ),
        )
        .toBe(true);
      await expect
        .poll(() =>
          closeButton.evaluate((element) => {
            const style = getComputedStyle(element);
            return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= 2;
          }),
        )
        .toBe(true);
      expectSafeAuthenticatedRequests(supabaseMock);
    });

    test("reduced-motionでもフォーカスをダイアログ内に保つ", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const supabaseMock = await loginToDashboard(page);
      const openButton = page.getByRole("button", {
        name: "今日、ちょっと失敗しちゃった...",
      });
      await openButton.click();
      const dialog = page.getByRole("dialog", { name: "Ta-Da!" });
      const closeButton = dialog.getByRole("button", { name: "ありがとう!🌟" });

      await expectFocusTrapped(page, closeButton);
      await expect(page.locator("canvas")).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(openButton).toBeFocused();
      expectSafeAuthenticatedRequests(supabaseMock);
    });
  });
}
