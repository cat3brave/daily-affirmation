import { expect, type Locator, type Page } from "@playwright/test";

async function expectAboveNavigation(page: Page, target: Locator) {
  const box = await target.boundingBox();
  const navigation = await page.getByRole("tablist", { name: "ダッシュボード" }).boundingBox();
  expect(box).not.toBeNull();
  expect(navigation).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThan(navigation!.y);
}

// 通常・本番の双方で、実サービスへ送らず既存フォームを操作します。
export async function checkGoodThingsEntry(page: Page) {
  const writes: Record<string, string>[] = [];
  await page.route("http://127.0.0.1:54321/rest/v1/three_good_things**", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    expect(route.request().headers().authorization).toBe("Bearer e2e-access-token");
    writes.push(route.request().postDataJSON());
    await route.fulfill({ status: 204 });
  });
  const entry = page.getByRole("button", { name: "よかったことを記録する" });
  await expect(entry).toHaveCount(1);
  await expect(page.getByLabel("1つ目のよかったこと")).toHaveCount(0);
  await entry.focus();
  await page.keyboard.press("Enter");
  const heading = page.getByRole("heading", { name: "🌷 3つのよかったこと" });
  await expect(heading).toBeFocused();
  await expectAboveNavigation(page, heading);
  await expect(page.getByRole("tab", { name: "ワーク", exact: true })).toHaveAttribute("aria-selected", "true");
  const input = page.getByLabel("1つ目のよかったこと");
  await expect(input).toHaveCount(1);
  await expect(input).not.toBeFocused();
  expect(await heading.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");
  await expect(input).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(input).toBeFocused();
  await input.fill("小さな花を見つけた");
  await expect(page.getByLabel("2つ目のよかったこと")).toHaveValue("");
  await expect(page.getByLabel("3つ目のよかったこと")).toHaveValue("");
  const save = page.getByRole("button", { name: "記録する", exact: true });
  await save.evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await expectAboveNavigation(page, save);
  await save.click();
  await expect(page.getByRole("status", { name: "保存状態" })).toHaveText("保存済み");
  await expect(save).toBeDisabled();
  expect(writes).toEqual([expect.objectContaining({ things1: "小さな花を見つけた", things2: "", things3: "", user_id: "e2e-user-id" })]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const home = page.getByRole("tab", { name: "ホーム", exact: true });
  await home.click();
  await expect(entry).toBeVisible();
  await home.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "ワーク", exact: true })).toBeFocused();
  await expect(input).toHaveCount(1);
  await expect(heading).not.toBeFocused();
  // 再度入口を使った場合は、新しい一度限りの移動として扱う。
  await home.click();
  await expect(entry).toBeVisible();
  await entry.click();
  await expect(heading).toBeFocused();
  await expectAboveNavigation(page, heading);
}
