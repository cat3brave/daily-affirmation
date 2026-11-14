import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  expectSafeAuthenticatedRequests,
  loginToDashboard,
  stubExternalServices,
} from "./support/supabaseMock";

const viewports = [
  { name: "320 CSS px", width: 320, height: 720 },
  { name: "通常幅", width: 1280, height: 720 },
];

async function expectMinimumTarget(locator: Locator) {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, "操作ターゲットのクリック可能領域を取得できること").not.toBeNull();
  expect(box!.width, "操作ターゲットの幅").toBeGreaterThanOrEqual(24);
  expect(box!.height, "操作ターゲットの高さ").toBeGreaterThanOrEqual(24);
}

async function expectAllEnabledButtonsMeetMinimum(page: Page) {
  const buttons = page.getByRole("button").filter({ visible: true });
  for (let index = 0; index < (await buttons.count()); index += 1) {
    const button = buttons.nth(index);
    if (await button.isEnabled()) await expectMinimumTarget(button);
  }
}

test.beforeEach(async ({ page }) => {
  await stubExternalServices(page);
});

for (const viewport of viewports) {
  test(`${viewport.name}で既存ユーザーのログイン操作ターゲットを検証する`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/login");
    await expectAllEnabledButtonsMeetMinimum(page);

    await expectMinimumTarget(page.getByRole("button", { name: "Googleでログイン" }));
    await expectMinimumTarget(page.getByRole("button", { name: "ログイン", exact: true }));
    await expectMinimumTarget(page.getByLabel("メールアドレス"));
    await expectMinimumTarget(page.getByLabel("パスワード"));
    await expect(page.getByText(/新規登録は受け付けていません。/)).toBeVisible();
    await expect(page.getByRole("button", { name: /新規登録|確認メール/ })).toHaveCount(0);
  });

  test(`${viewport.name}でダッシュボードの主要操作ターゲットを検証する`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const today = new Date().toLocaleDateString("sv-SE");
    const supabaseMock = await loginToDashboard(page, {
      favorite_affirmations: [{ text: "テスト用のお守りの言葉" }],
      three_good_things: [
        {
          date: today,
          things1: "よく眠れた",
          things2: "散歩できた",
          things3: "お茶がおいしかった",
        },
      ],
    });

    await expect(page.getByText("テスト用のお守りの言葉")).toBeVisible();
    await expectAllEnabledButtonsMeetMinimum(page);
    await expectMinimumTarget(
      page.getByRole("button", { name: "「テスト用のお守りの言葉」を削除" }),
    );

    await page.getByRole("tab", { name: "ワーク", exact: true }).click();
    await expect(page.getByText("🌷 3つのよかったこと")).toBeVisible();
    await expectAllEnabledButtonsMeetMinimum(page);

    const recordedDate = page.getByRole("button", {
      name: new RegExp(`${today}、記録あり`),
    });
    await expectMinimumTarget(recordedDate);
    await expect(recordedDate.locator("span")).toHaveCSS("width", "16px");
    await expect(recordedDate.locator("span")).toHaveCSS("height", "16px");
    await recordedDate.click();
    await expectMinimumTarget(
      page.getByRole("button", { name: `${today} の記録を削除` }),
    );

    const history = page.getByLabel("最近2週間の記録");
    await expect
      .poll(() =>
        history.evaluate((element) => ({
          internalScroll: element.scrollWidth > element.clientWidth,
          pageScroll:
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth,
        })),
      )
      .toEqual({ internalScroll: viewport.width === 320, pageScroll: false });

    await page.getByRole("tab", { name: "お守り", exact: true }).click();
    await expectAllEnabledButtonsMeetMinimum(page);
    await page.getByRole("button", { name: "今日、失敗しちゃった！" }).click();
    await expectMinimumTarget(
      page.getByRole("dialog", { name: "Ta-Da!" }).getByRole("button"),
    );

    expectSafeAuthenticatedRequests(supabaseMock);
  });
}

for (const width of [320, 1280]) {
  test(`${width}px・文字サイズ200%でも長いお気に入りの全文と削除操作がカード内に収まる`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    const favorites = [
      "焦らなくても大丈夫。あなたの歩幅で進んでいることに意味があります。".repeat(3),
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".repeat(5),
    ];
    const mock = await loginToDashboard(page, {
      favorite_affirmations: favorites.map((text) => ({ text })),
    });
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });

    for (const favorite of favorites) {
      const text = page.getByText(favorite, { exact: true });
      const remove = page.getByRole("button", { name: `「${favorite}」を削除`, exact: true });
      await expect(text).toHaveCSS("font-size", "28px");
      await expect(text).toHaveText(favorite);
      const layout = await text.evaluate((element) => {
        const card = element.closest("li")!;
        const button = card.querySelector("button")!;
        const c = card.getBoundingClientRect();
        const t = element.getBoundingClientRect();
        const b = button.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(element);
        return {
          cardInside: c.left >= 0 && c.right <= innerWidth && card.scrollWidth <= card.clientWidth,
          textInside: t.left >= c.left && t.right <= c.right && element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.clientHeight,
          allLinesInside: Array.from(range.getClientRects()).every(r => r.left >= t.left - 1 && r.right <= t.right + 1 && r.bottom <= t.bottom + 1),
          buttonInside: b.left >= c.left && b.right <= c.right && b.bottom <= c.bottom,
          separate: b.top >= t.bottom || b.left >= t.right,
          below: b.top >= t.bottom,
          targetWidth: b.width,
          targetHeight: b.height,
        };
      });
      expect(layout).toMatchObject({ cardInside: true, textInside: true, allLinesInside: true, buttonInside: true, separate: true });
      if (width === 320) expect(layout.below).toBe(true);
      expect(layout.targetWidth).toBeGreaterThanOrEqual(44);
      expect(layout.targetHeight).toBeGreaterThanOrEqual(44);

      await remove.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(remove).toBeFocused();
      await expect(remove).toHaveCSS("outline-style", "solid");
      await expect(remove).toHaveCSS("outline-width", "3px");
      expect(await remove.evaluate(el => el.matches(":focus-visible"))).toBe(true);
    }
    const list = page.getByText(favorites[0], { exact: true }).locator("../..");
    await list.screenshot({ path: `/tmp/favorite-after-${width}.png` });
    expectSafeAuthenticatedRequests(mock);
  });
}
