import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { Result } from "axe-core";
import {
  expectSafeAuthenticatedRequests,
  loginToDashboard,
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
