import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

// 縦に長いカードはスクロールして確認し、固定ナビを除いた領域で操作します。
export async function expectWorkControl(page: Page, target: Locator) {
  await target.evaluate(el => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await expect.poll(async () => {
    const box = await target.boundingBox();
    const nav = await page.getByRole("tablist", { name: "ダッシュボード" }).boundingBox();
    return !!box && !!nav && box.x >= 0 && box.x + box.width <= page.viewportSize()!.width
      && box.y >= 0 && box.y + box.height < nav.y;
  }).toBe(true);
  expect(await target.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
}

export async function expectWorkCopy(card: Locator) {
  // 固定高さからあふれた案内が、次の要素やボタンに重ならないこと。
  const paragraphs = card.locator(":scope > p");
  for (const paragraph of await paragraphs.all()) {
    expect(await paragraph.evaluate(el => {
      const box = el.getBoundingClientRect();
      const next = el.nextElementSibling?.getBoundingClientRect();
      return el.scrollHeight <= el.clientHeight + 1 && (!next || box.bottom <= next.top + 1);
    })).toBe(true);
  }
}

export async function captureWork(page: Page, info: TestInfo | undefined, name: string) {
  if (!info || page.viewportSize()!.width !== 320) return;
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await info.attach(name, { path, contentType: "image/png" });
}
