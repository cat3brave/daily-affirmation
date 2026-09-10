import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  expectSafeAuthenticatedRequests,
  loginToDashboard,
  stubExternalServices,
} from "./support/supabaseMock";

async function tabUntilFocused(page: Page, target: Locator) {
  for (let tabCount = 0; tabCount < 40; tabCount += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }

  throw new Error("40回のTab操作で対象要素へフォーカスできませんでした。");
}

async function expectVisibleKeyboardFocus(target: Locator) {
  await expect(target).toBeFocused();
  await expect
    .poll(() =>
      target.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          focusVisible: element.matches(":focus-visible"),
          outlineStyle: style.outlineStyle,
          outlineWidth: Number.parseFloat(style.outlineWidth),
        };
      }),
    )
    .toMatchObject({
      focusVisible: true,
      outlineStyle: "solid",
      outlineWidth: 3,
    });
}

test.beforeEach(async ({ page }) => {
  await stubExternalServices(page);
});

test("Tab操作でログイン画面とダッシュボードの主要操作に輪郭が表示される", async ({
  page,
}) => {
  await page.goto("/login");

  const emailInput = page.getByLabel("メールアドレス");
  const passwordInput = page.getByLabel("パスワード");
  const googleButton = page.getByRole("button", {
    name: "Googleでログイン",
    exact: true,
  });
  const loginButton = page.getByRole("button", {
    name: "ログイン",
    exact: true,
  });

  await page.keyboard.press("Tab");
  await expectVisibleKeyboardFocus(emailInput);
  await page.keyboard.press("Tab");
  await expectVisibleKeyboardFocus(passwordInput);
  await page.keyboard.press("Tab");
  await expectVisibleKeyboardFocus(googleButton);
  await page.keyboard.press("Tab");
  await expectVisibleKeyboardFocus(loginButton);

  const supabaseMock = await loginToDashboard(page);
  const tabs = ["ホーム", "ワーク", "お守り"].map((name) =>
    page.getByRole("button", { name, exact: true }),
  );

  await tabUntilFocused(page, tabs[0]);
  for (const tab of tabs) {
    await expectVisibleKeyboardFocus(tab);
    if (tab !== tabs.at(-1)) await page.keyboard.press("Tab");
  }

  await tabs[1].press("Enter");
  const translatorInput = page.getByLabel(
    "優しい言葉に翻訳したい自分への厳しい声",
  );
  await tabUntilFocused(page, translatorInput);
  await expectVisibleKeyboardFocus(translatorInput);
  await page.keyboard.type("今日はうまくできなかった");
  await page.keyboard.press("Tab");
  await expectVisibleKeyboardFocus(
    page.getByRole("button", { name: "優しい言葉に翻訳する 🪄" }),
  );

  await tabs[2].press("Enter");
  const tadaButton = page.getByRole("button", {
    name: "今日、失敗しちゃった！",
  });
  await tabUntilFocused(page, tadaButton);
  await expectVisibleKeyboardFocus(tadaButton);
  await page.keyboard.press("Enter");

  const closeButton = page
    .getByRole("dialog", { name: "Ta-Da!" })
    .getByRole("button", { name: "ありがとう!🌟" });
  await expectVisibleKeyboardFocus(closeButton);
  await page.keyboard.press("Enter");
  await expect(tadaButton).toBeFocused();

  expectSafeAuthenticatedRequests(supabaseMock);
});

test("reduced-motionでもTabフォーカスの輪郭が表示される", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.keyboard.press("Tab");
  await expectVisibleKeyboardFocus(page.getByLabel("メールアドレス"));
});
