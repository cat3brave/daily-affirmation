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

async function expectForcedColors(page: Page) {
  await expect
    .poll(() => page.evaluate(() => matchMedia("(forced-colors: active)").matches))
    .toBe(true);
}

async function expectNoPageHorizontalScroll(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth &&
        document.body.scrollWidth <= document.body.clientWidth,
      ),
    )
    .toBe(true);
}

async function expectOutlined(locator: Locator) {
  await expect
    .poll(() =>
      locator.evaluate((element) => {
        const style = getComputedStyle(element);
        return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= 2;
      }),
    )
    .toBe(true);
}

async function expectBordered(locator: Locator) {
  await expect
    .poll(() =>
      locator.evaluate(
        (element) => Number.parseFloat(getComputedStyle(element).borderTopWidth) >= 2,
      ),
    )
    .toBe(true);
}

async function expectAboveBottomBar(locator: Locator, bottomBar: Locator) {
  await locator.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "nearest" }),
  );
  await expect
    .poll(async () => {
      const [target, bar] = await Promise.all([locator.boundingBox(), bottomBar.boundingBox()]);
      return Boolean(target && bar && target.y + target.height <= bar.y);
    })
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await stubExternalServices(page);
});

for (const viewport of viewports) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport, forcedColors: "active" });

    test("ログインと新規登録の状態を識別して操作できる", async ({ page }) => {
      const authRequests = trackSupabaseAuthRequests(page);
      await page.goto("/login");
      await expectForcedColors(page);
      await expectNoPageHorizontalScroll(page);

      const email = page.getByLabel("メールアドレス");
      const password = page.getByLabel("パスワード");
      const login = page.getByRole("button", { name: "ログイン", exact: true });
      await expectBordered(email);
      await expectBordered(password);
      await expectBordered(login);

      await page.keyboard.press("Tab");
      const skipLink = page.getByRole("link", { name: "メインコンテンツへ移動" });
      await expect(skipLink).toBeFocused();
      await expect(skipLink).toBeVisible();
      await expectOutlined(skipLink);

      await login.click();
      const validationError = page.getByRole("alert").filter({
        hasText: "メールアドレスを入力してください。",
      });
      await expect(validationError).toHaveText("メールアドレスを入力してください。");
      await expect(email).toHaveAttribute("aria-invalid", "true");
      await expectBordered(validationError);

      await page.getByRole("button", { name: "はじめての方はこちら（新規登録）" }).click();
      await expect(page.getByRole("heading", { name: "はじめての登録🌱" })).toBeVisible();
      await email.fill("new-user@example.com");
      await password.fill("safe-e2e-password");
      await page.getByRole("button", { name: "確認メールを送る" }).click();
      const success = page.getByRole("status");
      await expect(success).toContainText("確認メールを送信しました");
      await expectBordered(success);
      await expectNoPageHorizontalScroll(page);

      expect(authRequests).toHaveLength(1);
      if (viewport.width === 320) {
        await page.screenshot({ path: "/tmp/forced-colors-login-320.png", fullPage: true });
      }
    });

    test("主要画面、記録状態、モーダルを識別して操作できる", async ({ page }) => {
      const recordedAt = new Date();
      recordedAt.setDate(recordedAt.getDate() - 1);
      const date = [
        recordedAt.getFullYear(),
        String(recordedAt.getMonth() + 1).padStart(2, "0"),
        String(recordedAt.getDate()).padStart(2, "0"),
      ].join("-");
      const favorite = "焦らなくても大丈夫。あなたの歩幅で進んでいます。";
      const supabaseMock = await loginToDashboard(page, {
        favorite_affirmations: [{ text: favorite }],
        bloom_logs: [{ created_at: recordedAt.toISOString() }],
        three_good_things: [{ date, things1: "温かいお茶を飲めた", things2: "", things3: "" }],
      });
      await expectForcedColors(page);

      const home = page.getByRole("button", { name: "ホーム", exact: true });
      const work = page.getByRole("button", { name: "ワーク", exact: true });
      const amulet = page.getByRole("button", { name: "お守り", exact: true });
      const bottomBar = home.locator("..");
      await expect(home).toHaveAttribute("aria-pressed", "true");
      await expect(home).toHaveCSS("text-decoration-line", "underline");
      await expect(work).toHaveAttribute("aria-pressed", "false");
      await expect(page.getByText(favorite)).toBeVisible();

      const birdView = page.getByRole("button", { name: /鳥の目線になる|地上に戻る/ });
      await birdView.click();
      await expect(birdView).toHaveAttribute("aria-pressed", "true");
      await expect(birdView).toHaveCSS("text-decoration-line", "underline");
      await birdView.click();

      const graph = page.getByRole("region", { name: "お花の成長記録（過去3ヶ月）" });
      await expect(graph.locator(".sr-only")).toContainText("期間内の合計開花数は1回です。");
      const recordedBloom = graph.locator('[data-bloom-recorded="true"]');
      const emptyBloom = graph.locator('[data-bloom-recorded="false"]').first();
      await expect(recordedBloom).toHaveCount(1);
      await expect
        .poll(async () => [await recordedBloom.evaluate((e) => getComputedStyle(e).backgroundColor), await emptyBloom.evaluate((e) => getComputedStyle(e).backgroundColor)])
        .not.toEqual(["rgb(255, 255, 255)", "rgb(255, 255, 255)"]);
      await expectNoPageHorizontalScroll(page);
      if (viewport.width === 320) await page.screenshot({ path: "/tmp/forced-colors-home-320.png", fullPage: true });

      await work.click();
      await expect(work).toHaveAttribute("aria-pressed", "true");
      await expect(work).toHaveCSS("text-decoration-line", "underline");
      const recordedDay = page.getByRole("button", { name: new RegExp(`^${date}、記録あり`) });
      const emptyDay = page.getByRole("button", { name: /記録なし/ }).first();
      await expect(recordedDay).toBeEnabled();
      await expect(emptyDay).toBeDisabled();
      await expectBordered(emptyDay);
      await recordedDay.click();
      await expect(recordedDay).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByText("温かいお茶を飲めた")).toBeVisible();
      await expectAboveBottomBar(page.getByRole("button", { name: "記録する" }), bottomBar);
      await expectNoPageHorizontalScroll(page);
      if (viewport.width === 320) await page.screenshot({ path: "/tmp/forced-colors-work-320.png", fullPage: true });

      await amulet.click();
      await expect(amulet).toHaveAttribute("aria-pressed", "true");
      const openModal = page.getByRole("button", { name: "今日、失敗しちゃった！" });
      await expectAboveBottomBar(openModal, bottomBar);
      if (viewport.width === 320) await page.screenshot({ path: "/tmp/forced-colors-amulet-320.png", fullPage: true });
      await openModal.click();
      const dialog = page.getByRole("dialog", { name: "Ta-Da!" });
      const close = dialog.getByRole("button", { name: "ありがとう!🌟" });
      await expect(dialog).toBeVisible();
      await expectBordered(dialog);
      await expect(close).toBeFocused();
      await expectOutlined(close);
      await expectNoPageHorizontalScroll(page);
      if (viewport.width === 320) await page.screenshot({ path: "/tmp/forced-colors-tada-320.png", fullPage: true });
      await close.click();
      await expect(dialog).toBeHidden();
      await expect(openModal).toBeFocused();

      expectSafeAuthenticatedRequests(supabaseMock);
    });
  });
}
