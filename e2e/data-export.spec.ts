import { expect, test, type Page } from "@playwright/test";
import { loginToDashboard, stubExternalServices } from "./support/supabaseMock";

test.use({ timezoneId: "Asia/Tokyo" });

async function expectNoHorizontalScroll(page: Page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth &&
    document.body.scrollWidth <= document.body.clientWidth,
  )).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await stubExternalServices(page);
});

test("保存済みの本人データ4種類をJSONファイルでダウンロードする", async ({ page }) => {
  await loginToDashboard(page);
  const exportedAt = "2026-09-27T15:30:00.000Z";
  // 実際のServer Actionのデータを維持し、返却時刻だけ固定する。
  // ブラウザーの時計を固定してもサーバーのexportedAtは変わらない。
  await page.route("**/dashboard", async (route) => {
    if (!route.request().headers()["next-action"]) return route.continue();
    const response = await route.fetch();
    const body = await response.text();
    const timestampPattern = /"exportedAt":"[^"]+"/g;
    expect(body.match(timestampPattern)).toHaveLength(1);
    await route.fulfill({ response, body: body.replace(timestampPattern, `"exportedAt":"${exportedAt}"`) });
  });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "データを書き出す" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let contents = "";
  for await (const chunk of stream) contents += chunk.toString();
  const data = JSON.parse(contents);

  expect(download.suggestedFilename()).toBe("daily-affirmation-export-2026-09-28.json");
  expect(data).toMatchObject({
    schemaVersion: 1,
    todos: [{ id: "todo-e2e", text: "深呼吸する", completed: true }],
    favoriteAffirmations: [{ id: "favorite-e2e", text: "今日も一歩ずつ" }],
    threeGoodThings: [{ id: "good-e2e", things1: "散歩", things2: "青空", things3: "温かいお茶" }],
    bloomLogs: [{ id: "bloom-e2e", flower_type: "tulip" }],
  });
  expect(data.exportedAt).toBe(exportedAt);
  expect(contents).not.toContain("other-user");
  expect(contents).not.toContain("他ユーザーの秘密");
  expect(contents).not.toContain("user_id");
  expect(contents).not.toMatch(/access.?token|refresh.?token|cookie|api.?key/i);
  await expect(page.getByText("保存済みデータを書き出しました。", { exact: true })).toBeVisible();
});

for (const viewport of [{ width: 320, height: 720 }, { width: 1280, height: 720 }]) {
  test(`${viewport.width}x${viewport.height}で書き出し操作が重ならず画面内に収まる`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await loginToDashboard(page);
    const exportButton = page.getByRole("button", { name: "データを書き出す" });
    const logoutButton = page.getByRole("button", { name: "👋 ログアウト" });
    await expect(exportButton).toBeVisible();
    await expectNoHorizontalScroll(page);
    const boxes = await Promise.all([exportButton.boundingBox(), logoutButton.boundingBox()]);
    expect(boxes.every(Boolean)).toBe(true);
    const [exportBox, logoutBox] = boxes as NonNullable<(typeof boxes)[number]>[];
    expect(exportBox.x + exportBox.width <= viewport.width).toBe(true);
    expect(logoutBox.x + logoutBox.width <= viewport.width).toBe(true);
    expect(exportBox.x + exportBox.width <= logoutBox.x || logoutBox.x + logoutBox.width <= exportBox.x || exportBox.y + exportBox.height <= logoutBox.y || logoutBox.y + logoutBox.height <= exportBox.y).toBe(true);
    await exportButton.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(exportButton).toBeFocused();
    await expect(exportButton).toHaveCSS("outline-style", "solid");
  });
}
