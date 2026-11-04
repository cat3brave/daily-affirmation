import { test } from "@playwright/test";
import { expectSafeAuthenticatedRequests, loginToDashboard } from "./support/supabaseMock";
import { checkGoodThingsEntry } from "./support/goodThingsEntry";

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`ホームから1つだけ記録する（320px・${reducedMotion}）`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.emulateMedia({ reducedMotion });
    const mock = await loginToDashboard(page);
    await checkGoodThingsEntry(page);
    expectSafeAuthenticatedRequests(mock);
  });
}
