import { expect, test } from "@playwright/test";
import {
  expectSafeAuthenticatedRequests,
  loginToDashboard,
  stubExternalServices,
  trackSupabaseAuthRequests,
} from "./support/supabaseMock";

test.beforeEach(async ({ page }) => {
  await stubExternalServices(page);
});

test("login succeeds and authenticated dashboard tabs can be navigated", async ({
  page,
}) => {
  const supabaseMock = await loginToDashboard(page);
  await expect(page.getByText("e2e-user さん🌷")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "言葉を受け取る" }),
  ).toBeVisible();
  await expect(page.getByText("🌸 デジタル花壇 🌸")).toBeVisible();

  await page.getByRole("button", { name: /ワーク/ }).click();
  await expect(page.getByText("優しい翻訳機")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "言葉を受け取る" }),
  ).toBeHidden();

  await page.getByRole("button", { name: /お守り/ }).click();
  await expect(page.getByText("失敗の救急箱")).toBeVisible();

  await page.getByRole("button", { name: /ホーム/ }).click();
  await expect(
    page.getByRole("button", { name: "言葉を受け取る" }),
  ).toBeVisible();
  await expect(page.getByText("🌸 デジタル花壇 🌸")).toBeVisible();

  expectSafeAuthenticatedRequests(supabaseMock);
});

test("公開ログイン画面をChromiumで表示できる", async ({ page }) => {
  await page.goto("/login");

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "おかえりなさい🌷" }),
  ).toBeVisible();
  await expect(page.getByLabel("メールアドレス")).toBeVisible();
  await expect(page.getByLabel("メールアドレス")).toHaveAttribute("id", "email");
  await expect(page.getByLabel("メールアドレス")).toHaveAttribute(
    "name",
    "email",
  );
  await expect(page.getByLabel("メールアドレス")).toHaveAttribute(
    "type",
    "email",
  );
  await expect(page.getByLabel("メールアドレス")).toHaveAttribute(
    "inputmode",
    "email",
  );
  await expect(page.getByLabel("メールアドレス")).toHaveAttribute(
    "autocomplete",
    "email",
  );
  await expect(page.getByLabel("パスワード")).toBeVisible();
  await expect(page.getByLabel("パスワード")).toHaveAttribute("id", "password");
  await expect(page.getByLabel("パスワード")).toHaveAttribute(
    "name",
    "password",
  );
  await expect(page.getByLabel("パスワード")).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  await expect(
    page.getByRole("button", { name: "ログイン", exact: true }),
  ).toBeVisible();
  const googleButton = page.getByRole("button", {
    name: "Googleでログイン",
    exact: true,
  });
  await expect(googleButton).toBeVisible();
  await expect(googleButton.locator("img")).toHaveAttribute(
    "src",
    "/google-g.svg",
  );
  await expect(googleButton.locator("img")).not.toHaveAttribute(
    "src",
    "https://www.google.com/favicon.ico",
  );
});

test("ログイン画面のTab移動順が入力から主要操作へ進む", async ({ page }) => {
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
  const signUpToggle = page.getByRole("button", {
    name: "はじめての方はこちら（新規登録）",
  });
  const skipLink = page.getByRole("link", {
    name: "メインコンテンツへ移動",
  });

  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(emailInput).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(passwordInput).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(googleButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(loginButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(signUpToggle).toBeFocused();
});

test("メールアドレス未入力では認証通信せず入力エラーを表示する", async ({
  page,
}) => {
  const supabaseAuthRequests = trackSupabaseAuthRequests(page);

  await page.goto("/login");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();

  await expect(page.getByLabel("メールアドレス")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("メールアドレス")).toHaveAttribute(
    "aria-describedby",
    "auth-message",
  );
  await expect(page.getByLabel("パスワード")).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "メールアドレスを入力してください。" }),
  ).toHaveText("メールアドレスを入力してください。");
  await expect(page).toHaveURL(/\/login$/);
  expect(supabaseAuthRequests).toHaveLength(0);
});

test("パスワード未入力では認証通信せず入力エラーを表示する", async ({ page }) => {
  const supabaseAuthRequests = trackSupabaseAuthRequests(page);

  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill("e2e-user@example.com");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();

  await expect(page.getByLabel("メールアドレス")).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("パスワード")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("パスワード")).toHaveAttribute(
    "aria-describedby",
    "auth-message",
  );
  await expect(
    page.getByRole("alert").filter({ hasText: "パスワードを入力してください。" }),
  ).toHaveText("パスワードを入力してください。");
  await expect(page).toHaveURL(/\/login$/);
  expect(supabaseAuthRequests).toHaveLength(0);
});

test("新規登録モードへ切り替えられる", async ({ page }) => {
  await page.goto("/login");

  await page
    .getByRole("button", { name: "はじめての方はこちら（新規登録）" })
    .click();

  await expect(
    page.getByRole("heading", { name: "はじめての登録🌱" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "確認メールを送る" }),
  ).toBeVisible();
  await expect(page.getByLabel("パスワード")).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
  await expect(
    page.getByRole("button", { name: /Googleでログイン/ }),
  ).toBeHidden();
});

test("新規登録モードからログインモードへ戻せる", async ({ page }) => {
  await page.goto("/login");

  await page
    .getByRole("button", { name: "はじめての方はこちら（新規登録）" })
    .click();
  await page.getByRole("button", { name: "すでに登録済みの方はこちら" }).click();

  await expect(
    page.getByRole("heading", { name: "おかえりなさい🌷" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ログイン", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("パスワード")).toHaveAttribute(
    "autocomplete",
    "current-password",
  );
  await expect(
    page.getByRole("button", { name: /Googleでログイン/ }),
  ).toBeVisible();
});

test("未ログインでdashboardへアクセスするとloginへ戻る", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByPlaceholder("メールアドレス")).toBeVisible();
  await expect(page.getByPlaceholder("パスワード")).toBeVisible();
});

test("未ログインでトップページへアクセスするとloginへ移動する", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "おかえりなさい🌷" }),
  ).toBeVisible();
});

test("存在しないURLではアプリ用の404案内を表示する", async ({ page }) => {
  const response = await page.goto("/this-page-does-not-exist");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "ページが見つかりませんでした" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "最初の画面へ戻る" }),
  ).toHaveAttribute("href", "/");
});
