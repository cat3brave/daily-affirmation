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

test("affirmation guidance and Server Action result match the configured mode", async ({ page }) => {
  const preparedMode = process.env.GEMINI_AFFIRMATION_ENABLED === "false";
  await loginToDashboard(page);
  const favoriteEndpoint = "http://127.0.0.1:54321/rest/v1/favorite_affirmations";
  await page.route(favoriteEndpoint, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 201 });
    } else {
      await route.fallback();
    }
  });
  const button = page.getByRole("button", {
    name: preparedMode ? "用意した言葉を受け取る" : "言葉を受け取る",
    exact: true,
  });
  await expect(button).toHaveAccessibleDescription(preparedMode
    ? "現在は、お守り言葉をもとに用意した言葉を表示します。"
    : "この機能は外部AI（Google Gemini）を利用します。");
  await button.click();
  const result = page.getByRole("status").filter({ hasText: "用意した言葉" });
  await expect(result).toBeVisible();
  const aiFallback = page.getByText(/AIの応答を取得できなかったため/);
  await expect(aiFallback).toHaveCount(preparedMode ? 0 : 1);
  await expect(button).toBeEnabled();
  const text = await result.locator("p").last().innerText();
  const saved = page.waitForResponse((response) =>
    response.url() === favoriteEndpoint && response.request().method() === "POST",
  );
  const favorite = page.getByRole("button", { name: /お気に入りにする/ });
  await favorite.click();
  const response = await saved;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).toEqual({ user_id: "e2e-user-id", text });
  await expect(page.getByRole("button", { name: /お気に入り済み/ })).toBeDisabled();
});

test("login succeeds and authenticated dashboard tabs can be navigated", async ({
  page,
}) => {
  const supabaseMock = await loginToDashboard(page);
  await expect(page.getByText("e2e-user さん🌷")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "言葉を受け取る" }),
  ).toBeVisible();
  await expect(
    page.getByText("この機能は外部AI（Google Gemini）を利用します。"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "言葉を受け取る" }),
  ).toHaveAttribute("aria-describedby", "affirmation-ai-guidance");
  await expect(page.getByText("🌸 デジタル花壇 🌸")).toBeVisible();

  await page.getByRole("tab", { name: /ワーク/ }).click();
  await expect(page.getByText("優しい翻訳機")).toBeVisible();
  const translatorInput = page.getByLabel(
    "優しい言葉に翻訳したい自分への厳しい声",
  );
  await expect(
    page.getByText(/入力した文章はGoogle Gemini APIへ送信されます/),
  ).toBeVisible();
  await expect(translatorInput).toHaveAttribute(
    "aria-describedby",
    /gentle-translator-guidance/,
  );
  await expect(
    page.getByRole("button", { name: "言葉を受け取る" }),
  ).toBeHidden();

  await page.getByRole("tab", { name: /お守り/ }).click();
  await expect(page.getByText("失敗の救急箱")).toBeVisible();

  await page.getByRole("tab", { name: /ホーム/ }).click();
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

test("ログイン画面のTab移動順がGoogleから入力と主要操作へ進む", async ({ page }) => {
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
  const skipLink = page.getByRole("link", {
    name: "メインコンテンツへ移動",
  });

  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(googleButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(emailInput).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(passwordInput).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(loginButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "パスワードを忘れた方" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "プライバシーとデータについて" })).toBeFocused();
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

test("登録受付停止を案内し、既存ユーザーのログイン入口を維持する", async ({ page }) => {
  const authRequests = trackSupabaseAuthRequests(page);
  await page.goto("/login");
  await expect(page.getByText(/新規登録は受け付けていません。/)).toBeVisible();
  await expect(page.getByRole("button", { name: /新規登録|確認メール|登録済みの方/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "はじめての登録🌱" })).toHaveCount(0);
  await expect(page.getByLabel("パスワード")).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByRole("button", { name: "Googleでログイン", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "ログイン", exact: true })).toBeVisible();
  expect(authRequests).toHaveLength(0);
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
