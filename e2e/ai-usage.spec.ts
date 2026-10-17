import { expect, test } from "@playwright/test";
import { loginToDashboard, stubAiActionResults, stubExternalServices } from "./support/supabaseMock";

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`AI usage alerts preserve input and allow another operation at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await stubExternalServices(page);
    await loginToDashboard(page);
    const minute = { status: "usage_limited", reason: "minute_limit", retryAt: "2026-10-18T00:01:00Z",
      message: "短時間の利用上限に達しました。少し待ってから再度お試しください。 再利用の目安：2026/10/18 09:01:00（日本時間）。" };
    const daily = { status: "usage_limited", reason: "daily_limit", retryAt: "2026-10-18T15:00:00Z",
      message: "本日の利用上限に達しました。 再利用の目安：2026/10/19 00:00:00（日本時間）。" };
    const unavailable = { status: "usage_unavailable", message: "利用状況を確認できませんでした。時間をおいて再度お試しください。" };
    const calls = await stubAiActionResults(page, [minute, { status: "success", text: "一歩ずつで十分ですよ" }, daily, unavailable, { status: "success", text: "今日もよく頑張りましたね。" }]);
    const generate = page.getByRole("button", { name: "言葉を受け取る", exact: true });
    await generate.click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(minute.message);
    await expect(generate).toBeEnabled();
    await generate.click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await expect(page.getByText("一歩ずつで十分ですよ")).toBeVisible();
    await page.getByRole("tab", { name: /ワーク/ }).click();
    const input = page.getByLabel("優しい言葉に翻訳したい自分への厳しい声");
    const translate = page.getByRole("button", { name: "優しい言葉に翻訳する 🪄" });
    await input.fill("入力を保持する");
    await translate.click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(daily.message);
    await expect(input).toHaveValue("入力を保持する");
    await expect(input).toBeEnabled();
    await translate.click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(unavailable.message);
    await expect(input).toHaveValue("入力を保持する");
    await translate.click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    await expect(page.getByText("今日もよく頑張りましたね。")).toBeVisible();
    expect(calls()).toBe(5);
  });
}
