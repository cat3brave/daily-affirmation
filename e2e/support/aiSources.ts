import { expect, type Page, type Locator, type TestInfo } from "@playwright/test";
import { stubAiActionResults } from "./supabaseMock";

// Text is checked line by line at scroll positions above the real fixed nav.
// Viewport captures retain the navigation and do not resize or hide any UI.
async function captureReadableScreens(page: Page, output: Locator, info: TestInfo, name: string) {
  const lines = await output.evaluate(el => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const rects: Array<{ left: number; right: number; top: number; bottom: number }> = [];
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(walker.currentNode);
      for (const r of range.getClientRects()) {
        if (r.width && r.height) rects.push({ left: r.left, right: r.right, top: r.top + scrollY, bottom: r.bottom + scrollY });
      }
    }
    return rects.sort((a, b) => a.top - b.top);
  });
  expect(lines.length).toBeGreaterThan(0);
  const navigation = page.getByRole("tablist", { name: "ダッシュボード" }).locator("..");
  let screen = 0;
  async function capture() {
    const path = info.outputPath(`${name}-screen-${++screen}.png`);
    await page.screenshot({ path, animations: "disabled" });
    await info.attach(`${name}-screen-${screen}`, { path, contentType: "image/png" });
  }
  await page.evaluate(top => window.scrollTo({ top, behavior: "instant" }), lines[0].top - 16);
  for (const line of lines) {
    const bottom = (await navigation.boundingBox())!.y - 12;
    let scroll = await page.evaluate(() => scrollY);
    if (line.top - scroll < 0 || line.bottom - scroll > bottom) {
      await capture();
      await page.evaluate(top => window.scrollTo({ top, behavior: "instant" }), line.top - 16);
      scroll = await page.evaluate(() => scrollY);
    }
    expect(line.top - scroll).toBeGreaterThanOrEqual(0);
    expect(line.bottom - scroll).toBeLessThanOrEqual((await navigation.boundingBox())!.y - 12);
    // A fixed overlay must not cover the text at this scroll position.
    expect(await output.evaluate((el, point) => el.contains(document.elementFromPoint(point.x, point.y)), {
      x: (line.left + line.right) / 2, y: (line.top + line.bottom) / 2 - scroll,
    })).toBe(true);
  }
  await capture();
}

async function checkScrollableControl(page: Page, control: Locator, info: TestInfo, name: string) {
  await control.evaluate(el => el.scrollIntoView({ block: "start", behavior: "instant" }));
  await control.evaluate(el => window.scrollBy({ top: el.getBoundingClientRect().top - 16, behavior: "instant" }));
  const box = (await control.boundingBox())!;
  const nav = (await page.getByRole("tablist", { name: "ダッシュボード" }).locator("..").boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(nav.y - 12);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await control.click({ trial: true });
  const path = info.outputPath(`${name}-control-screen.png`);
  await page.screenshot({ path, animations: "disabled" });
  await info.attach(`${name}-control-screen`, { path, contentType: "image/png" });
}

// UI境界のモック。実生成文の品質や実モデルの安全性を評価するものではありません。
export async function checkAiSources(page: Page, info: TestInfo) {
  const text = "ひとつの出来事で、すべてを決めなくてもいいですね。";
  const notice = "AIの応答を取得できなかったため、用意した言葉を表示しています。";
  const cases = [
    { status: "success", text },
    { status: "fallback", text },
    { status: "timed_out", text, message: "応答に時間がかかっています。少し時間をおいて、もう一度お試しください。" },
    new Error("mock rejection"),
    { status: "auth_required", message: "ログイン状態を確認できませんでした。ログインし直してください。" },
    { status: "rate_limited", message: "利用が集中しています。" },
    { status: "usage_limited", reason: "daily_limit", retryAt: "2026-11-06T15:00:00Z", message: "本日の利用上限に達しました。" },
    { status: "usage_unavailable", message: "利用状況を確認できませんでした。" },
    { status: "success", text },
  ];
  const translationText = "ひとつの出来事で、自分のすべてを決めなくてもよさそうですね。別の見方を少しずつ考えてみてもいいかもしれません。".repeat(2);
  const translationCases = cases.map(result => !(result instanceof Error) && result.status === "success"
    ? { ...result, text: translationText } : result);
  function pause() {
    let resume!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>(resolve => { resume = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    return { resume, started, response: async () => { entered(); await gate; return cases[1]; } };
  }
  const pauses = [pause(), pause()];
  const calls = await stubAiActionResults(page, [cases, translationCases].flatMap((results, kind) => results.map((value, index) => index === 1 ? pauses[kind].response : value)));
  for (const [kind, results] of [["affirmation", cases], ["translation", translationCases]] as const) {
    if (kind === "translation") {
      await page.getByRole("tab", { name: "ワーク", exact: true }).click();
      await expect(page.getByText("入力された内容をもとに、自分を責めすぎない見方の一例を提案します。")).toBeVisible();
      await page.getByLabel("優しい言葉に翻訳したい自分への厳しい声").fill("一度間違えただけで全部だめだと思う");
    }
    const button = page.getByRole("button", { name: kind === "affirmation" ? /言葉を受け取る|受け取り中/ : /優しい言葉に翻訳する|翻訳中/ });
    for (const [index, result] of results.entries()) {
      await button.click();
      if (index === 1) {
        const paused = pauses[kind === "affirmation" ? 0 : 1];
        await paused.started;
        try {
          await expect(button).toBeDisabled();
          await expect(page.getByRole("main").getByText(/AIによる提案|AIの応答を取得できなかったため/)).toHaveCount(0);
          await expect(page.getByRole("main").getByText(text, { exact: true })).toHaveCount(0);
          await expect(page.getByRole("main").getByText(translationText, { exact: true })).toHaveCount(0);
        } finally {
          paused.resume();
        }
      }
      await expect(button).toBeEnabled();
      const success = !(result instanceof Error) && result.status === "success";
      const preset = result instanceof Error || ["fallback", "timed_out"].includes(result.status);
      const main = page.getByRole("main");
      if (success || preset) {
        const output = main.getByRole("status").filter({ hasText: success ? "AIによる提案（見方の一例）" : notice });
        await expect(output).toBeVisible();
        await expect(main.getByText(success ? notice : /AIによる提案/)).toHaveCount(0);
        if (!(result instanceof Error) && result.status === "timed_out") {
          await expect(main.getByRole("alert")).toHaveText(result.message!);
        } else {
          await expect(main.getByRole("alert")).toHaveCount(0);
        }
        // 320px・文字拡大でも、追加案内が結果枠からはみ出さない。
        await expect.poll(() => output.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        const box = await output.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
        if (kind === "affirmation") {
          await expect.poll(() => page.getByRole("button", { name: "お気に入りにする 🌷" })
            .evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
          const card = await output.locator("../..").boundingBox();
          const favorite = await page.getByRole("button", { name: "お気に入りにする 🌷" }).boundingBox();
          expect(box!.y).toBeGreaterThanOrEqual(card!.y);
          expect(box!.y + box!.height).toBeLessThanOrEqual(card!.y + card!.height);
          expect(favorite!.y).toBeGreaterThanOrEqual(box!.y + box!.height);
          expect(favorite!.y + favorite!.height).toBeLessThanOrEqual(card!.y + card!.height);
        }
        if (kind === "translation") {
          const rootSize = await page.locator("html").evaluate(el => parseFloat(getComputedStyle(el).fontSize));
          const body = output.locator("p").last();
          const metrics = await body.evaluate(el => ({ width: el.getBoundingClientRect().width, fontSize: parseFloat(getComputedStyle(el).fontSize) }));
          expect(metrics.fontSize).toBeCloseTo(14 * rootSize / 16);
          // Leave room for at least six full-width characters without reducing text size.
          expect(metrics.width / metrics.fontSize).toBeGreaterThanOrEqual(6);
          if (preset) {
            const guidance = output.locator("p").first();
            expect(await guidance.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(12 * rootSize / 16);
          }
        }
        if (index <= 2) {
          await output.scrollIntoViewIfNeeded();
          const path = info.outputPath(`${kind}-${result instanceof Error ? "catch" : result.status}.png`);
          await output.screenshot({ path, animations: "disabled" });
          const name = `${kind}-${result instanceof Error ? "catch" : result.status}`;
          await info.attach(name, { path, contentType: "image/png" });
          if (page.viewportSize()!.width === 320) {
            await captureReadableScreens(page, output, info, name);
            if (kind === "affirmation") {
              await checkScrollableControl(page, page.getByRole("button", { name: "お気に入りにする 🌷" }), info, `${name}-favorite`);
            }
            await checkScrollableControl(page, button, info, name);
          }
        }
      } else {
        await expect(main.getByRole("alert")).toContainText(result.message!);
        if (!(result instanceof Error) && result.status === "auth_required") {
          await expect(main.getByRole("link", { name: "ログイン画面へ" })).toBeVisible();
        }
        await expect(main.getByText(/AIによる提案|AIの応答を取得できなかったため/)).toHaveCount(0);
        await expect(main.getByText(text, { exact: true })).toHaveCount(0);
        await expect(main.getByText(translationText, { exact: true })).toHaveCount(0);
      }
      if (kind === "translation") {
        await expect(page.getByLabel("優しい言葉に翻訳したい自分への厳しい声")).toHaveValue("一度間違えただけで全部だめだと思う");
      }
    }
  }
  expect(calls()).toBe(cases.length * 2);
}
