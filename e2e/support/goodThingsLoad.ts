import { expect, type Page } from "@playwright/test";
import { expectSafeAuthenticatedRequests, loginToDashboard } from "./supabaseMock";

// Real Supabase SDK and application code against a local filtered, capped API mock.
export async function checkBoundedGoodThingsLoad(page: Page) {
  await page.clock.install({ time: new Date("2025-12-31T15:05:00Z") });
  const past = Array.from({ length: 1200 }, (_, index) => ({
    user_id: "e2e-user-id",
    date: new Date(Date.UTC(2020, 0, index + 1)).toISOString().slice(0, 10),
    things1: "昔の記録",
  }));
  const dates = [
    "2025-12-19", "2025-12-20", "2025-12-21", "2025-12-22", "2025-12-23",
    "2025-12-24", "2025-12-25", "2025-12-26", "2025-12-27", "2025-12-28",
    "2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01",
  ];
  const reads: URL[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/rest/v1/three_good_things") reads.push(url);
  });
  const mock = await loginToDashboard(page, { three_good_things: [
    ...past,
    { user_id: "other", date: "2026-01-01", things1: "他人の記録" },
    ...dates.map(date => ({ user_id: "e2e-user-id", date, things1: `保存済み ${date}` })),
    { user_id: "e2e-user-id", date: "2026-01-02", things1: "翌日の保存済み" },
    { user_id: "e2e-user-id", date: "2026-01-21", things1: "新しい今日の保存済み" },
  ] });
  await page.getByRole("tab", { name: /ワーク/ }).click();
  const input = page.getByLabel("1つ目のよかったこと");
  const status = page.getByRole("status", { name: "保存状態" });
  await expect(input).toHaveValue("保存済み 2026-01-01");
  await expect(status).toHaveText("保存済み");
  expect(reads).toHaveLength(1);
  expect(reads[0].searchParams.get("date")).toBe(`in.(${dates.join(",")})`);
  expect(reads[0].searchParams.get("user_id")).toBe("eq.e2e-user-id");

  await input.fill("年始の下書き");
  const draft = await page.evaluate(() => localStorage.getItem("daily-affirmation:three-good-things-draft:e2e-user-id"));
  await page.clock.setFixedTime(new Date("2026-01-01T15:05:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByText("入力対象日：2026-01-01")).toBeVisible();
  await expect(input).toHaveValue("年始の下書き");
  expect(await page.evaluate(() => localStorage.getItem("daily-affirmation:three-good-things-draft:e2e-user-id"))).toBe(draft);
  const recent = page.getByLabel("最近2週間の記録");
  await expect(recent.getByTitle("2026-01-02")).toHaveAccessibleName("2026-01-02、記録あり、詳細を開く");
  expect(reads).toHaveLength(2);
  expect(reads[1].searchParams.get("date")).toBe(`in.(${[...dates.slice(1), "2026-01-02"].join(",")})`);
  expect(reads[1].searchParams.get("user_id")).toBe("eq.e2e-user-id");
  await expect(status).toHaveText("未保存の変更があります");
  await page.evaluate(() => {
    for (const event of ["focus", "pageshow", "focus"]) window.dispatchEvent(new Event(event));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(input).toBeEnabled();
  expect(reads).toHaveLength(2);

  let fail = true;
  await page.route("http://127.0.0.1:54321/rest/v1/three_good_things**", async route => {
    if (!fail || route.request().method() !== "GET") return route.fallback();
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Temporary read failure" }) });
  });
  await page.clock.setFixedTime(new Date("2026-01-20T15:05:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const loadError = page.getByRole("alert").filter({ hasText: "記録を読み込めませんでした" });
  await expect(loadError).toBeVisible();
  await expect(recent.getByTitle("2026-01-21")).toHaveAccessibleName("2026-01-21、記録の有無は未確認");
  await expect(status).toHaveText("未保存の変更があります");
  await expect(input).toHaveValue("年始の下書き");
  expect(await page.evaluate(() => localStorage.getItem("daily-affirmation:three-good-things-draft:e2e-user-id"))).toBe(draft);
  fail = false;
  await page.getByRole("button", { name: "3つのよかったことを再読み込み" }).click();
  await expect(recent.getByTitle("2026-01-21")).toHaveAccessibleName("2026-01-21、記録あり、詳細を開く");
  await expect(loadError).toHaveCount(0);
  await expect(status).toHaveText("未保存の変更があります");
  expect(reads.at(-1)!.searchParams.get("date")).toContain("2026-01-01");
  expect(reads.at(-1)!.searchParams.get("date")!.slice(4, -1).split(",")).toHaveLength(15);

  fail = true;
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "今日の入力へ" }).click();
  await expect(status).toHaveText("読み込みに失敗したため、保存状態を確認できません。");
  await expect(loadError).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "3つのよかったことを再読み込み" }).click();
  await expect(input).toHaveValue("新しい今日の保存済み");
  await expect(status).toHaveText("保存済み");
  await expect(loadError).toHaveCount(0);
  const latest = reads.at(-1)!;
  expect(latest.searchParams.get("date")).toBe(`in.(${Array.from({ length: 14 }, (_, i) => `2026-01-${String(i + 8).padStart(2, "0")}`).join(",")})`);
  expect(latest.searchParams.get("user_id")).toBe("eq.e2e-user-id");
  expectSafeAuthenticatedRequests(mock);
}
