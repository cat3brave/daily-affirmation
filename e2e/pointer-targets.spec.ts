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
  test(`${viewport.name}でログインと新規登録の操作ターゲットを検証する`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/login");
    await expectAllEnabledButtonsMeetMinimum(page);

    await page
      .getByRole("button", { name: "はじめての方はこちら（新規登録）" })
      .click();
    await expectMinimumTarget(
      page.getByRole("button", { name: "確認メールを送る" }),
    );
    await expectMinimumTarget(
      page.getByRole("button", { name: "すでに登録済みの方はこちら" }),
    );
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
