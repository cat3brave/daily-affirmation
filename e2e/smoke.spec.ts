import { expect, test, type Page } from "@playwright/test";

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

test.beforeEach(async ({ page }) => {
  await stubExternalServices(page);
});

test("公開ログイン画面をChromiumで表示できる", async ({ page }) => {
  await page.goto("/login");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
  await expect(
    page.locator("button").filter({ has: page.locator('img[alt="Google"]') }),
  ).toBeVisible();
});

test("未ログインでdashboardへアクセスするとloginへ戻る", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});
