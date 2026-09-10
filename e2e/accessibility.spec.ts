import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { Result } from "axe-core";
import {
  expectSafeAuthenticatedRequests,
  loginToDashboard,
  stubAuthenticatedSupabase,
  stubExternalServices,
} from "./support/supabaseMock";

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

function conciseViolations(violations: Result[]) {
  return violations.map(({ id, impact, description, nodes }) => ({
    id,
    impact,
    description,
    selectors: nodes.flatMap((node) => node.target),
  }));
}

async function expectNoAccessibilityViolations(page: Page, state: string) {
  await page.locator("body").evaluate(async (body) => {
    await Promise.all(
      body
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
  const { violations } = await new AxeBuilder({ page })
    .withTags(wcagTags)
    .analyze();

  expect(
    violations,
    `${state} のアクセシビリティ違反:\n${JSON.stringify(conciseViolations(violations), null, 2)}`,
  ).toEqual([]);
}

async function tabUntilFocused(
  page: Page,
  target: ReturnType<Page["getByRole"]>,
) {
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

test("公開ログイン画面と新規登録モードにWCAG A・AA違反がない", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "おかえりなさい🌷" }),
  ).toBeVisible();
  await expect(page.getByLabel("メールアドレス")).toBeVisible();
  await expect(page.getByLabel("パスワード")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ログイン", exact: true }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page, "公開ログイン画面");

  await page
    .getByRole("button", { name: "はじめての方はこちら（新規登録）" })
    .click();
  await expect(
    page.getByRole("heading", { name: "はじめての登録🌱" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "確認メールを送る" }),
  ).toBeVisible();
  await expect(page.getByText("確認メールが届きます。")).toBeVisible();
  await expectNoAccessibilityViolations(page, "新規登録モード");
});

test("キーボードだけでログインしダッシュボードのタブを切り替えられる", async ({
  page,
}) => {
  const supabaseMock = await stubAuthenticatedSupabase(page);
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
  await expect(
    page.getByRole("link", { name: "メインコンテンツへ移動" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(emailInput).toBeFocused();
  await page.keyboard.type("e2e-user@example.com");
  await page.keyboard.press("Tab");
  await expect(passwordInput).toBeFocused();
  await page.keyboard.type("e2e-password");
  await page.keyboard.press("Tab");
  await expect(googleButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(loginButton).toBeFocused();
  const appOrigin = new URL(page.url()).origin;
  const loginResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === "POST" &&
      url.pathname === "/auth/v1/token" &&
      url.searchParams.get("grant_type") === "password"
    );
  });
  const dashboardResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.origin === appOrigin && url.pathname === "/dashboard";
  });
  await page.keyboard.press("Enter");

  expect((await loginResponsePromise).ok()).toBe(true);
  expect((await dashboardResponsePromise).ok()).toBe(true);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("ログイン情報を確認しています...")).toBeHidden();

  const homeTab = page.getByRole("button", { name: "ホーム" });
  const workTab = page.getByRole("button", { name: "ワーク" });
  const amuletTab = page.getByRole("button", { name: "お守り" });

  await tabUntilFocused(page, homeTab);
  await expect(homeTab).toBeFocused();
  await page.keyboard.press("Space");
  await expect(homeTab).toBeFocused();
  await expect(homeTab).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("🌸 デジタル花壇 🌸")).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(workTab).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(workTab).toBeFocused();
  await expect(workTab).toHaveAttribute("aria-pressed", "true");
  await expect(homeTab).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("優しい翻訳機")).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(amuletTab).toBeFocused();
  await page.keyboard.press("Space");
  await expect(amuletTab).toBeFocused();
  await expect(amuletTab).toHaveAttribute("aria-pressed", "true");
  await expect(workTab).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("失敗の救急箱")).toBeVisible();

  await page.keyboard.press("Shift+Tab");
  await expect(workTab).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(homeTab).toBeFocused();

  expectSafeAuthenticatedRequests(supabaseMock);
});

test("認証済みダッシュボードの各タブにWCAG A・AA違反がない", async ({
  page,
}) => {
  const supabaseMock = await loginToDashboard(page);

  await expect(page.getByText("e2e-user さん🌷")).toBeVisible();
  await expect(page.getByRole("button", { name: "ホーム" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "言葉を受け取る" }),
  ).toBeVisible();
  await expect(page.getByText("🌸 デジタル花壇 🌸")).toBeVisible();
  await expectNoAccessibilityViolations(page, "ダッシュボードのホームタブ");

  await page.getByRole("button", { name: "ワーク" }).click();
  await expect(page.getByRole("button", { name: "ワーク" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("優しい翻訳機")).toBeVisible();
  await expectNoAccessibilityViolations(page, "ダッシュボードのワークタブ");

  await page.getByRole("button", { name: "お守り" }).click();
  await expect(page.getByRole("button", { name: "お守り" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("失敗の救急箱")).toBeVisible();
  await expectNoAccessibilityViolations(page, "ダッシュボードのお守りタブ");

  expectSafeAuthenticatedRequests(supabaseMock);
});
