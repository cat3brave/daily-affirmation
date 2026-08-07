import { expect, test, type Page } from "@playwright/test";

const supabaseAuthRequestUrlPattern =
  /^https:\/\/example\.supabase\.co\/auth\/v1\//;

async function stubExternalServices(page: Page) {
  await page.route("https://example.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());

    if (url.pathname.startsWith("/auth/v1/user")) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Missing session" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.route("https://generativelanguage.googleapis.com/**", (route) =>
    route.abort(),
  );
  await page.route("https://accounts.google.com/**", (route) => route.abort());
}

function trackSupabaseAuthRequests(page: Page) {
  const requests: string[] = [];

  page.on("request", (request) => {
    if (supabaseAuthRequestUrlPattern.test(request.url())) {
      requests.push(request.url());
    }
  });

  return requests;
}

test.beforeEach(async ({ page }) => {
  await stubExternalServices(page);
});

test("公開ログイン画面をChromiumで表示できる", async ({ page }) => {
  await page.goto("/login");

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "おかえりなさい🌷" }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("メールアドレス")).toBeVisible();
  await expect(page.getByPlaceholder("パスワード")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ログイン", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Googleでログイン/ }),
  ).toBeVisible();
});

test("メールアドレス未入力では認証通信せず入力エラーを表示する", async ({
  page,
}) => {
  const supabaseAuthRequests = trackSupabaseAuthRequests(page);

  await page.goto("/login");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();

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
  await page.getByPlaceholder("メールアドレス").fill("e2e-user@example.com");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();

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
