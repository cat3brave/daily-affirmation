import { expect, test } from "@playwright/test";
import { expectSafeAuthenticatedRequests, loginToDashboard } from "./support/supabaseMock";

test("月別に過去の文章を読み、月を移動しても入力を保持する（320pxを含む）", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 25, 12) });
  const longText = "longtext".repeat(100);
  const mock = await loginToDashboard(page, { three_good_things: [
    { user_id: "e2e-user-id", date: "2026-10-01", things1: "14日より前の記録", things2: longText },
    { user_id: "e2e-user-id", date: "2026-09-30", things1: "先月の記録" },
    { user_id: "other", date: "2026-09-29", things1: "他人の記録" },
    { date: "2026-10-26", things1: "未来の記録" },
  ] });
  await page.getByRole("tab", { name: /ワーク/ }).click();
  const input = page.getByRole("textbox", { name: "1つ目のよかったこと" });
  await expect(input).toBeEnabled(); await input.fill("入力途中の文章");
  await page.getByRole("button", { name: "過去の記録を見る" }).click();
  await expect(page.getByText("14日より前の記録")).toBeVisible();
  await expect(page.getByText("未来の記録")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "次の月" })).toBeDisabled();
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(page.getByText(longText)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "前の月" }).click();
  await expect(page.getByText("先月の記録")).toBeVisible();
  await expect(page.getByText("他人の記録")).toHaveCount(0);
  await page.getByRole("button", { name: "前の月" }).click();
  await expect(page.getByText("この月の記録はありません")).toBeVisible();
  await page.getByRole("button", { name: "次の月" }).click();
  await expect(page.getByText("先月の記録")).toBeVisible();
  await page.getByRole("button", { name: "今月へ" }).click();
  await expect(page.getByText("14日より前の記録")).toBeVisible();
  await expect(input).toHaveValue("入力途中の文章");
  await expect(page.getByText("入力対象日：2026-10-25")).toBeVisible();
  expectSafeAuthenticatedRequests(mock);
});
