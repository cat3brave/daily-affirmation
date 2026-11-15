import { expect, type Page, type TestInfo } from "@playwright/test";

import { captureWork, expectWorkControl, expectWorkCopy } from "./workLayout";

export async function checkBreathingRestart(page: Page, info?: TestInfo) {
  await page.getByRole("tab", { name: /ワーク/ }).click();
  await expect(page.getByRole("region", { name: "心を整えるワーク" })).toHaveCSS("opacity", "1");
  const card = page.getByText("🎈 4-4-8 深呼吸ナビ").locator("..");
  const status = card.getByRole("status");
  const now = Date.now();
  await page.clock.install({ time: new Date(now) });
  await page.clock.pauseAt(new Date(now + 1000));

  const entry = page.getByRole("link", { name: "深呼吸ガイドへ" });
  const heading = card.getByRole("heading", { name: "🎈 4-4-8 深呼吸ナビ" });
  await expect(entry).toHaveCount(1);
  const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  // Observe the real scroll call while preserving native browser scrolling.
  await heading.evaluate(el => {
    const scroll = el.scrollIntoView.bind(el);
    el.scrollIntoView = options => {
      el.setAttribute("data-scroll-behavior", typeof options === "object" ? options.behavior ?? "auto" : "auto");
      scroll(options);
    };
  });
  if (page.viewportSize()!.width === 320) {
    await entry.focus();
    await page.keyboard.press("Enter");
  } else {
    await entry.click();
  }
  await expect(heading).toBeFocused();
  await expect(heading).toHaveAttribute("data-scroll-behavior", reduced ? "instant" : "smooth");
  await expect.poll(async () => {
    const box = await heading.boundingBox();
    const nav = await page.getByRole("tablist", { name: "ダッシュボード" }).boundingBox();
    return !!box && !!nav && box.y >= 0 && box.y + box.height < nav.y;
  }).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.clock.runFor(60000);
  await expect(status).toHaveText("準備ができたらスタート");
  await expect(card.getByRole("button", { name: "ストップ" })).toHaveCount(0);
  await page.keyboard.press("Tab");
  const start = card.getByRole("button", { name: "深呼吸をはじめる" });
  await expect(start).toBeFocused();
  await expectWorkCopy(card);
  await expectWorkControl(page, start);
  await captureWork(page, info, "breathing-ready");
  await start.focus();
  await page.keyboard.press("Enter");
  await expect(status).toHaveAttribute("aria-live", "polite");
  await expect(status).toHaveText("鼻から深く吸って...");
  await expect(card.getByText("4", { exact: true })).toBeVisible();
  await expect(card.getByText("1 / 3回目")).toBeVisible();
  if (reduced) {
    await expect.poll(() => card.locator(".absolute").evaluate(el =>
      new DOMMatrixReadOnly(getComputedStyle(el).transform).a
    )).toBe(1);
  }

  // Let React commit each countdown update before advancing the next second.
  async function countdown(seconds: number) {
    for (let remaining = seconds - 1; remaining >= 1; remaining--) {
      await page.clock.runFor(1000);
      await expect(card.getByText(String(remaining), { exact: true })).toBeVisible();
    }
    await page.clock.runFor(1000);
  }

  for (let cycle = 1; cycle <= 3; cycle++) {
    await expect(card.getByText(`${cycle} / 3回目`)).toBeVisible();
    await countdown(4);
    await expect(status).toHaveText("そのまま止めて...");
    await expect(card.getByText("4", { exact: true })).toBeVisible();
    await countdown(4);
    await expect(status).toHaveText("口からゆっくり吐いて...");
    await expect(card.getByText("8", { exact: true })).toBeVisible();
    await countdown(8);
  }
  await expect(status).toHaveText("お疲れ様でした。少し心は落ち着きましたか？");
  const restart = card.getByRole("button", { name: "もう一度おこなう" });
  await expectWorkCopy(card);
  await expectWorkControl(page, restart);
  await captureWork(page, info, "breathing-completed");
  await restart.focus();
  await page.keyboard.press("Enter");
  await expect(status).toHaveText("鼻から深く吸って...");
  await expect(card.getByText("1 / 3回目")).toBeVisible();
  await expect(card.getByText("4", { exact: true })).toBeVisible();
  for (const remaining of [3, 2, 1]) {
    await page.clock.runFor(1000);
    await expect(status).toHaveText("鼻から深く吸って...");
    await expect(card.getByText(String(remaining), { exact: true })).toBeVisible();
  }
  await page.clock.runFor(1000);
  await expect(status).toHaveText("そのまま止めて...");

  const stop = card.getByRole("button", { name: "ストップ" });
  await stop.focus();
  await page.keyboard.press("Space");
  await expect(status).toHaveText("準備ができたらスタート");
  await page.clock.runFor(60000);
  await expect(status).toHaveText("準備ができたらスタート");
  await expect(start).toBeVisible();
  await start.focus();
  await page.keyboard.press("Space");
  await expect(status).toHaveText("鼻から深く吸って...");
  await expect(card.getByText("1 / 3回目")).toBeVisible();
  await expect(card.getByText("4", { exact: true })).toBeVisible();
  for (const remaining of [3, 2, 1]) {
    await page.clock.runFor(1000);
    await expect(status).toHaveText("鼻から深く吸って...");
    await expect(card.getByText(String(remaining), { exact: true })).toBeVisible();
  }
  await page.clock.runFor(1000);
  await expect(status).toHaveText("そのまま止めて...");
}
