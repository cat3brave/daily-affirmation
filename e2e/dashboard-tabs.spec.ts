import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  expectSafeAuthenticatedRequests,
  loginToDashboard,
} from "./support/supabaseMock";

const viewports = [
  { width: 320, height: 720 },
  { width: 1280, height: 720 },
] as const;

async function expectSelected(tab: Locator, selected: boolean) {
  await expect(tab).toHaveAttribute("aria-selected", String(selected));
  await expect(tab).toHaveAttribute("tabindex", selected ? "0" : "-1");
  await expect(tab).not.toHaveAttribute("aria-pressed");
}

async function expectNoHorizontalScroll(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
            document.documentElement.clientWidth &&
          document.body.scrollWidth <= document.body.clientWidth,
      ),
    )
    .toBe(true);
}

async function expectPanelRelationships(
  page: Page,
  selectedId: "home" | "work" | "amulet",
) {
  await expect(page.locator('[role="tabpanel"]')).toHaveCount(3);

  for (const id of ["home", "work", "amulet"] as const) {
    const tab = page.locator(`#dashboard-tab-${id}`);
    const panel = page.locator(`#dashboard-panel-${id}`);

    await expect(tab).toHaveAttribute("aria-controls", `dashboard-panel-${id}`);
    await expect(panel).toHaveAttribute("aria-labelledby", `dashboard-tab-${id}`);
    if (id === selectedId) {
      await expect(panel).toBeVisible();
      await expect(panel).not.toHaveAttribute("hidden");
    } else {
      await expect(panel).toBeHidden();
      await expect(panel).toHaveAttribute("hidden", "");
    }
  }
}

for (const viewport of viewports) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });

    test("ダッシュボードのタブをTabsパターンで操作できる", async ({ page }) => {
      const supabaseMock = await loginToDashboard(page);
      const tablist = page.getByRole("tablist", { name: "ダッシュボード" });
      const home = tablist.getByRole("tab", { name: "ホーム" });
      const work = tablist.getByRole("tab", { name: "ワーク" });
      const amulet = tablist.getByRole("tab", { name: "お守り" });

      await expect(tablist).toBeVisible();
      await expectSelected(home, true);
      await expectSelected(work, false);
      await expectSelected(amulet, false);
      for (const [tab, id] of [
        [home, "home"],
        [work, "work"],
        [amulet, "amulet"],
      ] as const) {
        await expect(tab).toHaveAttribute("id", `dashboard-tab-${id}`);
        await expect(tab).toHaveAttribute(
          "aria-controls",
          `dashboard-panel-${id}`,
        );
      }
      await expectPanelRelationships(page, "home");

      let panel = page.getByRole("tabpanel");
      await expect(panel).toHaveAttribute("id", "dashboard-panel-home");
      await expect(panel).toHaveAttribute(
        "aria-labelledby",
        "dashboard-tab-home",
      );
      await expect(page.getByText("🌸 デジタル花壇 🌸")).toBeVisible();
      await expect(page.getByText("優しい翻訳機")).toBeHidden();

      await home.focus();
      await page.keyboard.press("ArrowLeft");
      await expectSelected(amulet, true);
      await expect(amulet).toBeFocused();
      await expect(page.getByText("失敗の救急箱")).toBeVisible();
      await expect(page.getByText("🌸 デジタル花壇 🌸")).toHaveCount(0);
      await expect(page.getByText("優しい翻訳機")).toHaveCount(0);
      await expectPanelRelationships(page, "amulet");

      await page.keyboard.press("ArrowRight");
      await expectSelected(home, true);
      await expect(home).toBeFocused();
      await page.keyboard.press("End");
      await expectSelected(amulet, true);
      await expect(amulet).toBeFocused();
      await page.keyboard.press("Home");
      await expectSelected(home, true);
      await expect(home).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expectSelected(work, true);
      await expect(work).toBeFocused();
      await expect(page.getByText("優しい翻訳機")).toBeVisible();
      await expect(page.getByText("🌸 デジタル花壇 🌸")).toHaveCount(0);
      await expect(page.getByText("失敗の救急箱")).toHaveCount(0);
      await expectPanelRelationships(page, "work");

      panel = page.getByRole("tabpanel");
      await expect(panel).toHaveAttribute("id", "dashboard-panel-work");
      await expect(panel).toHaveAttribute(
        "aria-labelledby",
        "dashboard-tab-work",
      );
      await page.keyboard.press("Tab");
      await expect(amulet).not.toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(work).toBeFocused();

      await expectNoHorizontalScroll(page);
      const tablistBox = await tablist.boundingBox();
      expect(
        tablistBox &&
          tablistBox.x >= 0 &&
          tablistBox.x + tablistBox.width <= viewport.width &&
          tablistBox.y + tablistBox.height <= viewport.height,
      ).toBe(true);

      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(violations).toEqual([]);
      expectSafeAuthenticatedRequests(supabaseMock);
    });

    test("モーダル表示中はタブリストがinertな背景に含まれる", async ({
      page,
    }) => {
      const supabaseMock = await loginToDashboard(page);
      const tablist = page.getByRole("tablist", { name: "ダッシュボード" });
      await page
        .getByRole("button", { name: "今日、ちょっと失敗しちゃった..." })
        .click();
      await expect(page.getByRole("dialog", { name: "Ta-Da!" })).toBeVisible();
      await expect(tablist.locator("xpath=ancestor::*[@inert]")).toHaveCount(1);
      await expect(tablist).not.toBeFocused();
      expectSafeAuthenticatedRequests(supabaseMock);
    });
  });
}
