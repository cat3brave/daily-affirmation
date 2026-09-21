import { expect, test } from "@playwright/test";
import {
  expectSafeAuthenticatedRequests,
  loginToDashboard,
} from "./support/supabaseMock";

test("ダッシュボードの4領域を画面内で再読み込みできる", async ({ page }) => {
  const today = new Date().toISOString().slice(0, 10);
  const mock = await loginToDashboard(
    page,
    {
      favorite_affirmations: [{ text: "今日も一歩ずつ" }],
      bloom_logs: [{ created_at: new Date().toISOString() }],
      three_good_things: [
        { date: today, things1: "よく眠れた", things2: "", things3: "" },
      ],
    },
    {
      failFirstLoadFor: [
        "favorite_affirmations",
        "bloom_logs",
        "three_good_things",
      ],
    },
  );

  const favoriteRetry = page.getByRole("button", {
    name: "お気に入りを再読み込み",
  });
  const flowerRetry = page.getByRole("button", {
    name: "お花の数を再読み込み",
  });
  const graphRetry = page.getByRole("button", {
    name: "成長記録を再読み込み",
  });
  await expect.poll(() => mock.failedLoadRequests.join(",")).toContain("favorite_affirmations");
  await expect(favoriteRetry).toBeVisible();
  await expect(flowerRetry).toBeVisible();
  await expect(graphRetry).toBeVisible();
  mock.allowConfiguredLoad("favorite_affirmations");
  mock.allowConfiguredLoad("bloom_logs");
  await favoriteRetry.click();
  await flowerRetry.click();
  await graphRetry.click();
  await expect(page.getByText("今日も一歩ずつ")).toBeVisible();
  await expect(flowerRetry).toBeHidden();
  await expect(page.getByText(/期間内の合計開花数は1回です/)).toBeAttached();

  await page.getByRole("tab", { name: "ワーク" }).click();
  const goodThingsRetry = page.getByRole("button", {
    name: "3つのよかったことを再読み込み",
  });
  await expect(goodThingsRetry).toBeVisible();
  mock.allowConfiguredLoad("three_good_things");
  const draft = page.getByLabel("1つ目のよかったこと");
  await draft.fill("入力途中の大切な下書き");
  await goodThingsRetry.click();
  await expect(goodThingsRetry).toBeHidden();
  await expect(draft).toHaveValue("入力途中の大切な下書き");

  expectSafeAuthenticatedRequests(mock);
});
