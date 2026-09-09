import { expect, test } from "@playwright/test";
import {
  expectSafeAuthenticatedRequests,
  loginToDashboard,
  stubExternalServices,
} from "./support/supabaseMock";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubExternalServices(page);
});

test("動きを減らしても主要な画面と操作を利用できる", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "おかえりなさい🌷" }),
  ).toBeVisible();

  const supabaseMock = await loginToDashboard(page);
  await expect(
    page.getByRole("button", { name: "言葉を受け取る" }),
  ).toBeVisible();
  await expect(page.getByText("🌸 デジタル花壇 🌸")).toBeVisible();
  await expect(
    page.getByRole("img", { name: /花の成長状態/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: /ワーク/ }).click();
  await expect(
    page.getByRole("region", { name: "心を整えるワーク" }),
  ).toBeVisible();

  const breathingCard = page.getByText("🎈 4-4-8 深呼吸ナビ").locator("..");
  await breathingCard.getByRole("button", { name: "深呼吸をはじめる" }).click();
  await expect(breathingCard.getByRole("status")).toContainText(
    "鼻から深く吸って",
  );
  await expect(breathingCard.getByRole("button", { name: "ストップ" })).toBeEnabled();
  await breathingCard.getByRole("button", { name: "ストップ" }).click();
  await expect(
    breathingCard.getByRole("button", { name: "深呼吸をはじめる" }),
  ).toBeEnabled();

  await page.getByLabel("空に放ちたい決めつけ").fill("失敗する");
  await page.getByRole("button", { name: "放つ", exact: true }).click();
  await expect(page.getByText(/「失敗する」/)).toBeVisible();

  await page.getByRole("button", { name: /お守り/ }).click();
  await page.getByRole("button", { name: "今日、失敗しちゃった！" }).click();
  const dialog = page.getByRole("dialog", { name: "Ta-Da!" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "ありがとう!🌟" })).toBeFocused();
  await expect(page.locator("canvas")).toHaveCount(0);
  await dialog.getByRole("button", { name: "ありがとう!🌟" }).click();
  await expect(dialog).toBeHidden();

  expectSafeAuthenticatedRequests(supabaseMock);
});
