import { expect, test } from "@playwright/test";
import { loginToDashboard } from "./support/supabaseMock";

test("mock account change hides old personal data and ignores an old deletion failure", async ({ page }) => {
  const mock = await loginToDashboard(page, {
    favorite_affirmations: [{ text: "Aだけのお気に入り" }, { text: "削除待ちのA" }],
    bloom_logs: [{ created_at: new Date().toISOString() }],
  });
  await expect(page.getByText("Aだけのお気に入り", { exact: true })).toBeVisible();
  let started!: () => void;
  const deleteStarted = new Promise<void>((resolve) => { started = resolve; });
  let release!: () => void;
  const responseGate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/rest/v1/favorite_affirmations?**", async (route) => {
    if (route.request().method() !== "DELETE") { await route.fallback(); return; }
    if (new URL(route.request().url()).searchParams.get("user_id") === "eq.user-B") {
      await route.fulfill({ status: 204 });
      return;
    }
    started();
    await responseGate;
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "mock delayed failure" }) });
  });
  await page.getByRole("button", { name: "「削除待ちのA」を削除", exact: true }).click();
  await deleteStarted;
  await page.getByRole("button", { name: "今日もお散歩した！ 💧", exact: true }).click();
  await expect(page.getByRole("img", { name: "花の成長状態: 芽が出ました！その調子！" })).toBeVisible();
  await mock.changeAuthUser("user-B", { favorite_affirmations: [{ text: "Bだけのお気に入り" }] });
  await expect(page.getByText("Bだけのお気に入り", { exact: true })).toBeVisible();
  await expect(page.getByText("Aだけのお気に入り", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "花の成長状態: 種を植えました。お散歩して育てよう！" })).toBeVisible();
  const oldResponse = page.waitForResponse((response) => response.request().method() === "DELETE");
  release(); await oldResponse;
  // Complete a current-owner operation after the old response, ensuring the
  // browser has processed both continuations before checking the final list.
  const currentResponse = page.waitForResponse((response) => response.request().method() === "DELETE" && new URL(response.url()).searchParams.get("user_id") === "eq.user-B");
  await page.getByRole("button", { name: "「Bだけのお気に入り」を削除", exact: true }).click();
  await currentResponse;
  await expect(page.getByText("Bだけのお気に入り", { exact: true })).toHaveCount(0);
  await expect(page.getByText("削除待ちのA", { exact: true })).toHaveCount(0);
  await expect(page.getByText("お気に入りの削除に失敗しました。もう一度お試しください。")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("favoriteAffirmations:user-B"))).toBe("[]");
  await mock.changeAuthUser(null);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Bだけのお気に入り", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "データを書き出す", exact: true })).toHaveCount(0);
});
