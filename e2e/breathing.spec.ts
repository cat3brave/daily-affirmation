import { test } from "@playwright/test";
import { checkBreathingRestart } from "./support/breathing";
import { expectSafeAuthenticatedRequests, loginToDashboard, stubExternalServices } from "./support/supabaseMock";

for (const width of [320, 1280]) {
for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`深呼吸を1操作で再開しキーボードで停止できる (${width}px・${reducedMotion})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 720 });
    await page.emulateMedia({ reducedMotion });
    await stubExternalServices(page);
    const mock = await loginToDashboard(page);
    await checkBreathingRestart(page);
    expectSafeAuthenticatedRequests(mock);
  });
}
}
