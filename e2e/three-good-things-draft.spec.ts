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
