import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loginToDashboard, stubExternalServices } from "./support/supabaseMock";

test("削除確認は段階的で、通信切断後は再送せず照合し本人データだけを消去する", async ({ page }) => {
  await stubExternalServices(page);
  await loginToDashboard(page);
  await page.evaluate(() => {
    localStorage.setItem("favoriteAffirmations:e2e-user-id", '["本人"]');
    localStorage.setItem("favoriteAffirmations:other", '["他人"]');
  });
  const actions: string[] = [];
  await page.route("**/account/delete/request", async route => {
    const { action } = route.request().postDataJSON(); actions.push(action);
    if (action === "delete") return route.abort();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      status: action === "prepare" ? "pending" : action === "verify" ? "ready" : "succeeded",
      ...(action === "status" ? { cleanupUserId: "e2e-user-id" } : {}),
    }) });
  });
  await page.goto("/account/delete");
  await expect(page.getByRole("link", { name: "削除せず戻る" })).toBeFocused();
  await expect(page.getByRole("button",{name:"メールで本人確認する"})).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button",{name:"メールで本人確認する"}).click();
  await page.getByLabel("確認コード").fill("123456");
  await page.getByRole("button",{name:"コードを確認する"}).click();
  await expect(page.getByRole("button",{name:"アカウントとデータを削除する"})).toBeDisabled();
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.getByRole("checkbox").check();
  await page.getByRole("button",{name:"アカウントとデータを削除する"}).click();
  await expect(page.getByRole("button",{name:"処理結果を確認する"})).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("favoriteAffirmations:e2e-user-id"))).not.toBeNull();
  await page.getByRole("button",{name:"処理結果を確認する"}).click();
  await expect(page).toHaveURL(/\/login\?accountDeleted=1$/);
  await expect(page.getByText("アカウントの削除が完了しました。")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("favoriteAffirmations:e2e-user-id"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("favoriteAffirmations:other"))).toBe('["他人"]');
  expect(actions).toEqual(["prepare","verify","delete","status"]);
});

test("未ログインの案内と320pxリフロー", async ({ page }) => {
  await stubExternalServices(page);
  await page.setViewportSize({width:320,height:720});
  await page.goto("/account/delete");
  await expect(page.getByRole("link",{name:"ログインして本人確認に進む"})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});
