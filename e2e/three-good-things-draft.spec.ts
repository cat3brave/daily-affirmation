import { expect, test } from "@playwright/test";
import {
  expectSafeAuthenticatedRequests,
  loginToDashboard,
} from "./support/supabaseMock";

test("3つのよかったことの下書きをタブ移動と再読み込み後に復元する", async ({
  page,
}) => {
  const supabaseMock = await loginToDashboard(page);
  const draft = "散歩の途中できれいな花を見つけた";

  await page.getByRole("tab", { name: /ワーク/ }).click();
  const firstThing = page.getByRole("textbox", {
    name: "1つ目のよかったこと",
  });
  await expect(firstThing).toBeEnabled();
  await firstThing.fill(draft);
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.localStorage
          .getItem("daily-affirmation:three-good-things-draft:e2e-user-id")
          ?.includes("散歩の途中できれいな花を見つけた"),
      ),
    )
    .toBe(true);

  await page.getByRole("tab", { name: /ホーム/ }).click();
  await expect(
    page.locator('textarea[aria-label="1つ目のよかったこと"]'),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: /ワーク/ }).click();
  await expect(firstThing).toHaveValue(draft);
  const restoredStatus = page
    .getByRole("status")
    .filter({ hasText: "この端末に一時保存した今日の入力を復元しました。" });
  await expect(restoredStatus).toBeVisible();

  await page.reload();
  await expect(page.getByText("ログイン情報を確認しています...")).toBeHidden();
  await page.getByRole("tab", { name: /ワーク/ }).click();
  await expect(
    page.getByRole("textbox", { name: "1つ目のよかったこと" }),
  ).toHaveValue(draft);
  await expect(restoredStatus).toBeVisible();

  expectSafeAuthenticatedRequests(supabaseMock);
});

test("別タブのログアウト後は古いタブの入力画面を操作できない", async ({
  page,
  context,
}) => {
  const supabaseMock = await loginToDashboard(page);
  await page.getByRole("tab", { name: /ワーク/ }).click();
  await page.getByRole("textbox", { name: "1つ目のよかったこと" }).fill("Aの入力中データ");

  const otherTab = await context.newPage();
  await otherTab.goto("/dashboard");
  await expect(otherTab.getByText("ログイン情報を確認しています...")).toBeHidden();
  otherTab.on("dialog", (dialog) => dialog.accept());
  await otherTab.getByRole("button", { name: "ログアウト" }).click();

  await expect(otherTab).toHaveURL(/\/login$/);
  await page.route("http://127.0.0.1:54321/auth/v1/user", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Missing session" }),
    }),
  );
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("textbox", { name: "1つ目のよかったこと" })).toHaveCount(0);
  expectSafeAuthenticatedRequests(supabaseMock);
});

test("対象日を表示し保存・削除中は操作を止め、完了後に再入力できる", async ({ page }) => {
  await loginToDashboard(page);
  // Only this test allows writes, all fulfilled locally without Supabase access.
  let releaseWrite: (() => void) | undefined;
  const writes: Array<{ method: string; date: string | null }> = [];
  await page.route("http://127.0.0.1:54321/rest/v1/three_good_things**", async (route) => {
    const request = route.request();
    if (!["POST", "DELETE"].includes(request.method())) return route.fallback();
    writes.push({ method: request.method(), date: request.method() === "POST"
      ? request.postDataJSON().date : new URL(request.url()).searchParams.get("date") });
    await new Promise<void>((resolve) => { releaseWrite = resolve; });
    await route.fulfill({ status: 204 });
  });
  await page.getByRole("tab", { name: /ワーク/ }).click();
  const input = page.getByRole("textbox", { name: "1つ目のよかったこと" });
  await expect(input).toBeEnabled();
  const date = await page.evaluate(() => {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
  });
  await expect(page.getByText(`入力対象日：${date}`)).toBeVisible();
  await input.fill("花がきれいだった");
  await page.getByRole("button", { name: "記録する", exact: true }).click();
  await expect(page.getByRole("button", { name: "保存中..." })).toBeDisabled();
  await expect(input).toBeDisabled();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({ method: "POST", date });
  releaseWrite?.();
  await expect(page.getByText(/保存しました/)).toBeVisible();
  await expect(input).toBeEnabled();
  await input.fill("保存後の新しい入力");
  const remove = page.getByRole("button", { name: `${date} の記録を削除` });
  page.once("dialog", (dialog) => dialog.accept());
  await remove.click();
  await expect.poll(() => writes.length).toBe(2);
  await expect(remove).toBeDisabled();
  await expect(input).toBeDisabled();
  await expect(page.getByRole("button", { name: "記録する", exact: true })).toBeDisabled();
  expect(writes[1]).toEqual({ method: "DELETE", date: `eq.${date}` });
  releaseWrite?.();
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue("");
  await input.fill("削除後の入力");
  await expect(page.getByRole("button", { name: "記録する", exact: true })).toBeEnabled();
  expect(writes).toHaveLength(2);
});

test("保存状態を継続表示し、同じ保存値への追加通信を送らない", async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 25, 12) });
  const mock = await loginToDashboard(page, { three_good_things: [
    { user_id: "e2e-user-id", date: "2026-10-25", things1: "保存した文章", things2: "", things3: "" },
  ] });
  const writes: unknown[] = [];
  await page.route("http://127.0.0.1:54321/rest/v1/three_good_things**", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    writes.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  await page.getByRole("tab", { name: /ワーク/ }).click();
  const input = page.getByRole("textbox", { name: "1つ目のよかったこと" });
  const status = page.getByRole("status", { name: "保存状態" });
  const save = page.getByRole("button", { name: "記録する", exact: true });
  await expect(status).toHaveText("保存済み");
  await expect(save).toBeDisabled();
  await input.fill("  保存した文章  ");
  await expect(status).toHaveText("保存済み");
  await save.evaluate(button => (button as HTMLButtonElement).click());
  expect(writes).toHaveLength(0);
  await input.fill("編集した文章");
  await expect(status).toHaveText("未保存の変更があります");
  await save.click();
  await expect(status).toHaveText("保存済み");
  await expect(save).toBeDisabled();
  await page.clock.fastForward(4000);
  await expect(status).toHaveText("保存済み");
  await input.fill(" 編集した文章 ");
  await expect(status).toHaveText("保存済み");
  await save.evaluate(button => (button as HTMLButtonElement).click());
  expect(writes).toHaveLength(1);
  await input.fill("もう一度編集");
  await expect(status).toHaveText("未保存の変更があります");
  await expect(save).toBeEnabled();
  expect(writes).toEqual([expect.objectContaining({ date: "2026-10-25", things1: "編集した文章" })]);
  expectSafeAuthenticatedRequests(mock);
});
