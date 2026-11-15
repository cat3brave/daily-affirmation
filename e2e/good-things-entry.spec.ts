import { test } from "@playwright/test";
import { expectSafeAuthenticatedRequests, loginToDashboard } from "./support/supabaseMock";
import { checkGoodThingsEntry } from "./support/goodThingsEntry";

for (const fontSize of [100, 200]) {
for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`ホームから1つだけ記録する（320px・文字${fontSize}%・${reducedMotion}）`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.emulateMedia({ reducedMotion });
    const mock = await loginToDashboard(page);
    await page.evaluate(size => { document.documentElement.style.fontSize = `${size}%`; }, fontSize);
    await checkGoodThingsEntry(page, testInfo);
    expectSafeAuthenticatedRequests(mock);
  });
}
}
