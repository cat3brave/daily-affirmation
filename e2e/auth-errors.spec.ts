import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  stubExternalServices,
  stubRejectedAuthSupabase,
} from "./support/supabaseMock";

const EMAIL = "e2e-user@example.com";
const PASSWORD = "e2e-password";

async function expectNoHorizontalOverflow(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  await expect
    .poll(() =>
      locator.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
          insideViewport: rect.left >= 0 && rect.right <= window.innerWidth,
          pageFits:
            document.documentElement.scrollWidth <=
              document.documentElement.clientWidth &&
            document.body.scrollWidth <= document.body.clientWidth,
        };
      }),
    )
    .toEqual({ insideViewport: true, pageFits: true });
}

test.beforeEach(async ({ page }) => {
  await stubExternalServices(page);
});

test("Enter送信の入力不足を通知し、修正後は古いエラーを残さない", async ({
  page,
}) => {
  await page.goto("/login");
  const email = page.getByLabel("メールアドレス");
  const password = page.getByLabel("パスワード");

  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(email).toBeFocused();
  await page.keyboard.press("Enter");

  const emailError = page.locator("#auth-message");
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toHaveAttribute("aria-describedby", "auth-message");
  await expect(emailError).toHaveText("メールアドレスを入力してください。");
  await expect(page.locator("#auth-message")).toHaveCount(1);

  await page.keyboard.type(EMAIL);
  await expect(emailError).toBeHidden();
  await expect(email).not.toHaveAttribute("aria-invalid");
  await expect(email).not.toHaveAttribute("aria-describedby");
  await page.keyboard.press("Enter");

  await expect(password).toBeFocused();
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await expect(password).toHaveAttribute("aria-describedby", "auth-message");
  await expect(page.locator("#auth-message")).toHaveText(
    "パスワードを入力してください。",
  );

  await page.keyboard.type(PASSWORD);
  await expect(page.locator("#auth-message")).toBeHidden();
  await expect(password).not.toHaveAttribute("aria-invalid");
  await expect(password).not.toHaveAttribute("aria-describedby");
});

test("ログイン失敗をフォーム全体のエラーとして通知し、再送信できる", async ({
  page,
}) => {
  const mock = await stubRejectedAuthSupabase(page);
  await page.goto("/login");
  const email = page.getByLabel("メールアドレス");
  const password = page.getByLabel("パスワード");

  await email.fill(EMAIL);
  await password.fill(PASSWORD);
  await password.press("Enter");

  const alert = page.locator("#auth-message");
  await expect(alert).toHaveText(
    "ログインに失敗しました。メールアドレスとパスワードを確認してください。",
  );
  await expect(alert).toBeFocused();
  await expect(email).toHaveValue(EMAIL);
  await expect(email).not.toHaveAttribute("aria-invalid");
  await expect(password).not.toHaveAttribute("aria-invalid");

  await page.keyboard.press("Tab");
  await expect(email).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.type("x");
  await page.keyboard.press("Backspace");
  await expect(alert).toBeHidden();
  await page.keyboard.press("Enter");
  await expect(alert).toBeFocused();

  expect(mock.loginRequestBodies).toEqual([
    { email: EMAIL, password: PASSWORD, gotrue_meta_security: {} },
    { email: EMAIL, password: PASSWORD, gotrue_meta_security: {} },
  ]);
  expect(mock.signUpRequestBodies).toEqual([]);
  expect(mock.restWriteRequests).toEqual([]);
  expect(mock.unexpectedAuthRequests).toEqual([]);
  expect(mock.unexpectedRestRequests).toEqual([]);
});

test("新規登録失敗後も入力とモード固有属性を保ち、切り替えでエラーを消す", async ({
  page,
}) => {
  const mock = await stubRejectedAuthSupabase(page);
  await page.goto("/login");
  const email = page.getByLabel("メールアドレス");
  const password = page.getByLabel("パスワード");

  await page
    .getByRole("button", { name: "はじめての方はこちら（新規登録）" })
    .press("Enter");
  await expect(email).toHaveAttribute("autocomplete", "email");
  await expect(password).toHaveAttribute("autocomplete", "new-password");
  await email.fill(EMAIL);
  await password.fill(PASSWORD);
  await password.press("Enter");

  const alert = page.locator("#auth-message");
  await expect(alert).toHaveText(
    "登録に失敗しました。メールアドレスやパスワードを確認してください。",
  );
  await expect(alert).toBeFocused();
  await expect(email).toHaveValue(EMAIL);
  await expect(email).not.toHaveAttribute("aria-invalid");
  await expect(password).not.toHaveAttribute("aria-invalid");

  await page
    .getByRole("button", { name: "すでに登録済みの方はこちら" })
    .press("Enter");
  await expect(alert).toBeHidden();
  await expect(password).toHaveAttribute("autocomplete", "current-password");
  await expect(email).toHaveAttribute("autocomplete", "email");

  expect(mock.signUpRequestBodies).toHaveLength(1);
  expect(mock.signUpRequestBodies[0]).toMatchObject({
    email: EMAIL,
    password: PASSWORD,
  });
  expect(mock.loginRequestBodies).toEqual([]);
  expect(mock.restWriteRequests).toEqual([]);
  expect(mock.unexpectedAuthRequests).toEqual([]);
  expect(mock.unexpectedRestRequests).toEqual([]);
});

test("320x720で入力エラーと再操作UIが重ならず横スクロールしない", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/login");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();

  for (const locator of [
    page.locator("#auth-message"),
    page.getByLabel("メールアドレス"),
    page.getByLabel("パスワード"),
    page.getByRole("button", { name: "ログイン", exact: true }),
  ]) {
    await expectNoHorizontalOverflow(page, locator);
  }
});
