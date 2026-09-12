import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  expectSafeAuthenticatedRequests,
  loginToDashboard,
  stubExternalServices,
  trackSupabaseAuthRequests,
} from "./support/supabaseMock";

const viewports = [
  { width: 320, height: 720 },
  { width: 1280, height: 720 },
] as const;

const textSpacingStyles = `
  * {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  p {
    margin-bottom: 2em !important;
  }
`;

async function applyTextSpacing(page: Page) {
  await page.addStyleTag({ content: textSpacingStyles });
}

async function expectNoPageHorizontalScroll(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => ({
        body: document.body.scrollWidth <= document.body.clientWidth,
        root:
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      })),
    )
    .toEqual({ body: true, root: true });
}

async function expectFullyVisible(locator: Locator) {
  await expect(locator).toBeVisible();
  await expect
    .poll(() =>
      locator.evaluate((element) => ({
        horizontal: element.scrollWidth <= element.clientWidth + 1,
        vertical: element.scrollHeight <= element.clientHeight + 1,
      })),
    )
    .toEqual({ horizontal: true, vertical: true });
}

async function expectAboveBottomBar(locator: Locator, bottomBar: Locator) {
  await locator.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "nearest" }),
  );
  await expect(locator).toBeVisible();
  await expect
    .poll(async () => {
      const [targetBox, barBox] = await Promise.all([
        locator.boundingBox(),
        bottomBar.boundingBox(),
      ]);
      return Boolean(targetBox && barBox && targetBox.y + targetBox.height <= barBox.y);
    })
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await stubExternalServices(page);
});

for (const viewport of viewports) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("ログイン、新規登録、入力エラーがテキスト間隔を維持する", async ({
      page,
    }) => {
      const authRequests = trackSupabaseAuthRequests(page);
      await page.goto("/login");
      await applyTextSpacing(page);

      await expectFullyVisible(
        page.getByRole("heading", { name: "おかえりなさい🌷" }),
      );
      await expectFullyVisible(page.getByLabel("メールアドレス"));
      await expectFullyVisible(page.getByLabel("パスワード"));
      await expectFullyVisible(
        page.getByRole("button", { name: "Googleでログイン" }),
      );
      await expectNoPageHorizontalScroll(page);
      if (viewport.width === 320) {
        await page.screenshot({
          path: "/tmp/text-spacing-login-320.png",
          fullPage: true,
        });
      }

      await page.keyboard.press("Tab");
      const skipLink = page.getByRole("link", {
        name: "メインコンテンツへ移動",
      });
      await expect(skipLink).toBeFocused();
      await expect(skipLink).toBeVisible();

      await page.getByRole("button", { name: "ログイン", exact: true }).click();
      await expectFullyVisible(
        page.getByRole("alert").filter({
          hasText: "メールアドレスを入力してください。",
        }),
      );
      await expect(page.getByLabel("メールアドレス")).toHaveAttribute(
        "aria-invalid",
        "true",
      );

      await page.getByLabel("メールアドレス").fill("person@example.com");
      await page.getByLabel("パスワード").fill("invalid-password");
      await page.getByRole("button", { name: "ログイン", exact: true }).click();
      await expectFullyVisible(
        page.getByRole("alert").filter({
          hasText:
            "ログインに失敗しました。メールアドレスとパスワードを確認してください。",
        }),
      );
      await expectNoPageHorizontalScroll(page);

      await page
        .getByRole("button", { name: "はじめての方はこちら（新規登録）" })
        .click();
      await expectFullyVisible(
        page.getByRole("heading", { name: "はじめての登録🌱" }),
      );
      await expectFullyVisible(
        page.getByText(
          "メール内のリンクを押してからログインしてください。",
          { exact: false },
        ),
      );
      await expectFullyVisible(
        page.getByRole("button", { name: "確認メールを送る" }),
      );
      await expectNoPageHorizontalScroll(page);
      expect(authRequests).toHaveLength(1);
      expect(authRequests[0]).toMatch(
        /^https:\/\/example\.supabase\.co\/auth\/v1\/token/,
      );

      if (viewport.width === 320) {
        await page.screenshot({
          path: "/tmp/text-spacing-sign-up-320.png",
          fullPage: true,
        });
      }
    });

    test("主要画面と固定操作がテキスト間隔を維持する", async ({ page }) => {
      const recordDate = new Date();
      recordDate.setDate(recordDate.getDate() - 1);
      const date = [
        recordDate.getFullYear(),
        String(recordDate.getMonth() + 1).padStart(2, "0"),
        String(recordDate.getDate()).padStart(2, "0"),
      ].join("-");
      const favorite =
        "焦らなくても大丈夫。あなたの歩幅で進んでいることに意味があります。";
      const supabaseMock = await loginToDashboard(page, {
        favorite_affirmations: [{ text: favorite }],
        bloom_logs: [{ created_at: new Date().toISOString() }],
        three_good_things: [
          {
            date,
            things1: "温かいお茶をゆっくり飲めた",
            things2: "長い文章でも大切な記録を最後まで読むことができた",
            things3: "友だちと笑顔で話せた",
          },
        ],
      });
      await applyTextSpacing(page);

      const bottomBar = page.getByRole("button", { name: "ホーム" }).locator("..");
      const homeTab = page.getByRole("button", { name: "ホーム" });
      const workTab = page.getByRole("button", { name: "ワーク" });
      const amuletTab = page.getByRole("button", { name: "お守り" });

      await expectFullyVisible(page.getByText("🌷 お気に入りの言葉"));
      await expectFullyVisible(page.getByText(favorite));
      const bloomGraph = page.getByRole("region", {
        name: "お花の成長記録（過去3ヶ月）",
      });
      await expect(bloomGraph).toBeVisible();
      await expect(
        bloomGraph.locator(".sr-only").getByText(/対象期間は/),
      ).toBeAttached();
      await expectFullyVisible(homeTab);
      await expectFullyVisible(workTab);
      await expectFullyVisible(amuletTab);
      await expectNoPageHorizontalScroll(page);
      if (viewport.width === 320) {
        await page.screenshot({
          path: "/tmp/text-spacing-home-320.png",
          fullPage: true,
        });
      }

      await workTab.click();
      await expect(workTab).toHaveAttribute("aria-pressed", "true");
      await expectFullyVisible(page.getByText("🌷 3つのよかったこと"));
      const inputs = ["1つ目", "2つ目", "3つ目"].map((ordinal) =>
        page.getByLabel(`${ordinal}のよかったこと`),
      );
      for (const [index, input] of inputs.entries()) {
        await input.fill(`間隔を広げても入力できる内容 ${index + 1}`);
        await expect(input).toHaveValue(`間隔を広げても入力できる内容 ${index + 1}`);
        await expectFullyVisible(input);
      }
      const history = page.getByLabel("最近2週間の記録");
      await expect(history).toHaveAttribute("tabindex", "0");
      await expect
        .poll(() =>
          history.evaluate(
            (element) => element.scrollWidth > element.clientWidth,
          ),
        )
        .toBe(viewport.width === 320);
      await history.focus();
      await expect(history).toBeFocused();
      await page.getByRole("button", { name: new RegExp(`^${date}、記録あり`) }).click();
      const detail = page.getByText(`${date} のよかったこと`, { exact: false });
      await expectFullyVisible(detail);
      await expectFullyVisible(
        page.getByText("長い文章でも大切な記録を最後まで読むことができた"),
      );
      await expectAboveBottomBar(
        page.getByRole("button", { name: "記録する" }),
        bottomBar,
      );
      await expectNoPageHorizontalScroll(page);
      if (viewport.width === 320) {
        await page.screenshot({
          path: "/tmp/text-spacing-work-320.png",
          fullPage: true,
        });
      }

      await amuletTab.click();
      await expect(amuletTab).toHaveAttribute("aria-pressed", "true");
      await expectFullyVisible(page.getByText("失敗の救急箱"));
      const tadaButton = page.getByRole("button", {
        name: "今日、失敗しちゃった！",
      });
      await expectAboveBottomBar(tadaButton, bottomBar);
      if (viewport.width === 320) {
        await page.screenshot({
          path: "/tmp/text-spacing-amulet-320.png",
          fullPage: true,
        });
      }
      await tadaButton.click();
      const dialog = page.getByRole("dialog", { name: "Ta-Da!" });
      await expectFullyVisible(dialog);
      const closeButton = dialog.getByRole("button", { name: "ありがとう!🌟" });
      await expectFullyVisible(closeButton);
      await expect(closeButton).toBeFocused();
      await expectNoPageHorizontalScroll(page);

      if (viewport.width === 320) {
        await page.screenshot({
          path: "/tmp/text-spacing-tada-320.png",
          fullPage: true,
        });
      }

      await closeButton.click();
      await expect(dialog).toBeHidden();
      await expect(tadaButton).toBeFocused();
      await homeTab.click();
      await expect(homeTab).toHaveAttribute("aria-pressed", "true");
      expectSafeAuthenticatedRequests(supabaseMock);
    });
  });
}
