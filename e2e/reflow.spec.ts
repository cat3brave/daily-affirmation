import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  expectSafeAuthenticatedRequests,
  loginToDashboard,
  stubExternalServices,
} from "./support/supabaseMock";

const viewport = { width: 320, height: 720 };

async function expectNoPageHorizontalScroll(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        body: document.body.scrollWidth <= document.body.clientWidth,
        root:
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      })),
    )
    .toEqual({ body: true, root: true });
}

async function expectInsideViewport(locator: Locator) {
  await expect(locator).toBeVisible();
  await expect
    .poll(() =>
      locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left >= 0 && rect.right <= window.innerWidth;
      }),
    )
    .toBe(true);
}

async function expectVisibleFocus(locator: Locator) {
  await expect(locator).toBeFocused();
  await expect
    .poll(() =>
      locator.evaluate((element) => {
        const style = getComputedStyle(element);
        return (
          element.matches(":focus-visible") &&
          style.outlineStyle === "solid" &&
          Number.parseFloat(style.outlineWidth) >= 2
        );
      }),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(viewport);
  await stubExternalServices(page);
});

test("320 CSS pxでログインと新規登録がページ内にリフローする", async ({
  page,
}) => {
  await page.goto("/login");

  await expectInsideViewport(
    page.getByRole("heading", { name: "おかえりなさい🌷" }),
  );
  await expectInsideViewport(page.getByLabel("メールアドレス"));
  await expectInsideViewport(page.getByLabel("パスワード"));
  await expectNoPageHorizontalScroll(page);

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "メインコンテンツへ移動" });
  await expectVisibleFocus(skipLink);
  await expectInsideViewport(skipLink);

  await page
    .getByRole("button", { name: "はじめての方はこちら（新規登録）" })
    .click();
  await expectInsideViewport(
    page.getByRole("heading", { name: "はじめての登録🌱" }),
  );
  await expectInsideViewport(
    page.getByRole("button", { name: "確認メールを送る" }),
  );
  await expectNoPageHorizontalScroll(page);
});

test("320 CSS pxで全ダッシュボード画面と固定タブがリフローする", async ({
  page,
}) => {
  const supabaseMock = await loginToDashboard(page);
  const homeTab = page.getByRole("button", { name: "ホーム", exact: true });
  const workTab = page.getByRole("button", { name: "ワーク", exact: true });
  const amuletTab = page.getByRole("button", { name: "お守り", exact: true });

  await expectInsideViewport(page.getByText("🌸 デジタル花壇 🌸"));
  await expectInsideViewport(
    page.getByRole("region", { name: "お花の成長記録（過去3ヶ月）" }),
  );
  for (const tab of [homeTab, workTab, amuletTab]) {
    await expectInsideViewport(tab);
  }
  await expectNoPageHorizontalScroll(page);

  await workTab.click();
  await expectInsideViewport(
    page.getByRole("region", { name: "心を整えるワーク" }),
  );
  await expectInsideViewport(page.getByText("🌷 3つのよかったこと"));

  const history = page.getByLabel("最近2週間の記録");
  await expectInsideViewport(history);
  await expect(history).toHaveAttribute("tabindex", "0");
  await history.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expectVisibleFocus(history);
  await expect
    .poll(() =>
      history.evaluate((element) => ({
        hasInternalOverflow: element.scrollWidth > element.clientWidth,
        buttonWidths: Array.from(element.querySelectorAll("button"), (button) =>
          button.getBoundingClientRect().width,
        ),
      })),
    )
    .toEqual({
      hasInternalOverflow: true,
      buttonWidths: Array(14).fill(16),
    });
  await expectNoPageHorizontalScroll(page);

  await amuletTab.click();
  await expectInsideViewport(page.getByText("失敗の救急箱"));
  await page.getByRole("button", { name: "今日、失敗しちゃった！" }).click();
  const dialog = page.getByRole("dialog", { name: "Ta-Da!" });
  await expectInsideViewport(dialog);
  await expectInsideViewport(
    dialog.getByRole("button", { name: "ありがとう!🌟" }),
  );
  await expectNoPageHorizontalScroll(page);

  expectSafeAuthenticatedRequests(supabaseMock);
});
