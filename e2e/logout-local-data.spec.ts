import { expect, test, type Page } from "@playwright/test";
import { loginToDashboard } from "./support/supabaseMock";

const currentFavoriteKey = "favoriteAffirmations:e2e-user-id";
const currentDraftKey = "daily-affirmation:three-good-things-draft:e2e-user-id";
const otherFavoriteKey = "favoriteAffirmations:other-user";
const otherDraftKey = "daily-affirmation:three-good-things-draft:other-user";
const currentFavorite = '["現在ユーザーのお気に入り"]';
const currentDraft = JSON.stringify({ date: "2026-09-29", things: ["現在ユーザーの下書き", "", ""] });
const otherFavorite = '["別ユーザーのお気に入り"]';
const otherDraft = JSON.stringify({ date: "2026-09-29", things: ["別ユーザーの下書き", "", ""] });

async function loginAfterFavoriteSync(page: Page) {
  await loginToDashboard(page, {
    favorite_affirmations: [{ text: "同期完了を確認するお気に入り" }],
  });
  await expect(page.getByText("同期完了を確認するお気に入り")).toBeVisible();
}

async function seedUserLocalData(page: Page) {
  await page.evaluate(
    (entries) => entries.forEach(([key, value]) => localStorage.setItem(key, value)),
    [
      [currentFavoriteKey, currentFavorite],
      [currentDraftKey, currentDraft],
      [otherFavoriteKey, otherFavorite],
      [otherDraftKey, otherDraft],
    ],
  );
}

async function readUserLocalData(page: Page) {
  return page.evaluate(
    (keys) => keys.map((key) => localStorage.getItem(key)),
    [currentFavoriteKey, currentDraftKey, otherFavoriteKey, otherDraftKey],
  );
}

test("成功時は現在ユーザーのデータだけを消去しログアウト通信を重複しない", async ({ page }) => {
  await loginAfterFavoriteSync(page);
  await seedUserLocalData(page);
  let logoutRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/auth/v1/logout") logoutRequests += 1;
  });
  page.once("dialog", (dialog) => dialog.accept());

  await page.getByRole("button", { name: "👋 ログアウト", exact: true }).dblclick();
  await expect(page).toHaveURL(/\/login$/);

  expect(logoutRequests).toBe(1);
  expect(await readUserLocalData(page)).toEqual([null, null, otherFavorite, otherDraft]);
});

test("下書き確認をキャンセルすると通信せずdashboardと全データを保持する", async ({ page }) => {
  await loginAfterFavoriteSync(page);
  await seedUserLocalData(page);
  let logoutRequests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/auth/v1/logout") logoutRequests += 1;
  });
  page.once("dialog", (dialog) => dialog.dismiss());

  await page.getByRole("button", { name: "👋 ログアウト", exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  expect(logoutRequests).toBe(0);
  expect(await readUserLocalData(page)).toEqual([currentFavorite, currentDraft, otherFavorite, otherDraft]);
});
