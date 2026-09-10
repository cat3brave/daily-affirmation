import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  expectSafeAuthenticatedRequests,
  loginToDashboard,
  stubExternalServices,
} from "./support/supabaseMock";

async function useSkipLink(page: Page, target: Locator) {
  const skipLink = page.getByRole("link", {
    name: "メインコンテンツへ移動",
  });

  await expect
    .poll(() =>
      skipLink.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.bottom <= 0 ||
          rect.right <= 0 ||
          rect.top >= window.innerHeight ||
          rect.left >= window.innerWidth
        );
      }),
    )
    .toBe(true);
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await expect
    .poll(() =>
      skipLink.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          focusVisible: element.matches(":focus-visible"),
          withinViewport:
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= window.innerHeight &&
            rect.right <= window.innerWidth,
        };
      }),
    )
    .toEqual({ focusVisible: true, withinViewport: true });
  await expect(skipLink).toHaveCSS("outline-width", "3px");
  await page.keyboard.press("Enter");
  await expect(target).toBeFocused();
}

async function tabUntilFocused(page: Page, target: Locator) {
  for (let tabCount = 0; tabCount < 30; tabCount += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }

  throw new Error("30回のTab操作で対象要素へフォーカスできませんでした。");
}

test.beforeEach(async ({ page }) => {
  await stubExternalServices(page);
});

test("ログイン画面でメインコンテンツをスキップ後も入力できる", async ({
  page,
}) => {
  await page.goto("/login");

  await useSkipLink(page, page.locator("#main-content"));
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("メールアドレス")).toBeFocused();
  await page.keyboard.type("e2e-user@example.com");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("パスワード")).toBeFocused();
});

test("認証済みダッシュボードで現在のタブ内容へ移動後もタブを操作できる", async ({
  page,
}) => {
  const supabaseMock = await loginToDashboard(page);

  await page.reload();
  await expect(page.getByText("ログイン情報を確認しています...")).toBeHidden();
  await useSkipLink(page, page.locator("#main-content"));
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "言葉を受け取る" })).toBeFocused();

  const workTab = page.getByRole("button", { name: "ワーク" });
  await tabUntilFocused(page, workTab);
  await page.keyboard.press("Enter");
  await expect(workTab).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("優しい翻訳機")).toBeVisible();

  expectSafeAuthenticatedRequests(supabaseMock);
});

test("reduced-motionでもスキップリンクを利用できる", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");

  await useSkipLink(page, page.locator("#main-content"));
});
