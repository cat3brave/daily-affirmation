import { expect, test, type Page } from "@playwright/test";

const supabaseAuthRequestUrlPattern =
  /^https:\/\/example\.supabase\.co\/auth\/v1\//;
const e2eUser = {
  id: "e2e-user-id",
  aud: "authenticated",
  role: "authenticated",
  email: "e2e-user@example.com",
  email_confirmed_at: "2026-08-13T00:00:00.000Z",
  phone: "",
  confirmed_at: "2026-08-13T00:00:00.000Z",
  last_sign_in_at: "2026-08-13T00:00:00.000Z",
  app_metadata: {
    provider: "email",
    providers: ["email"],
  },
  user_metadata: {},
  identities: [],
  created_at: "2026-08-13T00:00:00.000Z",
  updated_at: "2026-08-13T00:00:00.000Z",
};
const e2eSessionResponse = {
  access_token: "e2e-access-token",
  token_type: "bearer",
  expires_in: 3600,
  refresh_token: "e2e-refresh-token",
  user: e2eUser,
};
const allowedDashboardRestTables = new Set([
  "bloom_logs",
  "favorite_affirmations",
  "three_good_things",
]);

type LoginRequestBody = {
  email?: unknown;
  password?: unknown;
};

type AuthenticatedSupabaseMock = {
  loginRequestBodies: LoginRequestBody[];
  restWriteRequests: string[];
  unexpectedAuthRequests: string[];
  unexpectedRestRequests: string[];
};

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

async function stubAuthenticatedSupabase(
  page: Page,
): Promise<AuthenticatedSupabaseMock> {
  const mockState: AuthenticatedSupabaseMock = {
    loginRequestBodies: [],
    restWriteRequests: [],
    unexpectedAuthRequests: [],
    unexpectedRestRequests: [],
  };

  await page.route("https://example.supabase.co/auth/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (
      request.method() === "POST" &&
      url.pathname === "/auth/v1/token" &&
      url.searchParams.get("grant_type") === "password"
    ) {
      mockState.loginRequestBodies.push(request.postDataJSON());

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...e2eSessionResponse,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        }),
      });
      return;
    }

    if (request.method() === "GET" && url.pathname === "/auth/v1/user") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(e2eUser),
      });
      return;
    }

    mockState.unexpectedAuthRequests.push(`${request.method()} ${url.href}`);
    await route.abort();
  });

  await page.route("https://example.supabase.co/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const table = url.pathname.replace("/rest/v1/", "").split("/")[0];

    if (["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
      mockState.restWriteRequests.push(`${method} ${url.href}`);
      await route.abort();
      return;
    }

    if (!["GET", "HEAD"].includes(method)) {
      mockState.unexpectedRestRequests.push(`${method} ${url.href}`);
      await route.abort();
      return;
    }

    if (!allowedDashboardRestTables.has(table)) {
      mockState.unexpectedRestRequests.push(`${method} ${url.href}`);
      await route.abort();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "content-range": request.method() === "HEAD" ? "0-0/0" : "*/0",
      },
      body: request.method() === "HEAD" ? "" : "[]",
    });
  });

  return mockState;
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

test("login succeeds and authenticated dashboard tabs can be navigated", async ({
  page,
}) => {
  const supabaseMock = await stubAuthenticatedSupabase(page);

  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill("e2e-user@example.com");
  await page.getByLabel("パスワード").fill("e2e-password");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("ログイン情報を確認しています...")).toBeHidden();
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

  expect(supabaseMock.loginRequestBodies).toEqual([
    {
      email: "e2e-user@example.com",
      password: "e2e-password",
      gotrue_meta_security: {},
    },
  ]);
  expect(supabaseMock.restWriteRequests).toEqual([]);
  expect(supabaseMock.unexpectedAuthRequests).toEqual([]);
  expect(supabaseMock.unexpectedRestRequests).toEqual([]);
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
  await expect(
    page.getByRole("button", { name: "Googleでログイン", exact: true }),
  ).toBeVisible();
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
