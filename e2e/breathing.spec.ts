import { test } from "@playwright/test";
import { checkBreathingRestart } from "./support/breathing";
import { expectSafeAuthenticatedRequests, loginToDashboard, stubExternalServices } from "./support/supabaseMock";

for (const width of [320, 1280]) {
for (const fontSize of (width === 320 ? [100, 200] : [100])) {
for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`深呼吸を1操作で再開しキーボードで停止できる (${width}px・文字${fontSize}%・${reducedMotion})`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 720 });
    await page.emulateMedia({ reducedMotion });
    await stubExternalServices(page);
    const mock = await loginToDashboard(page);
    await page.evaluate(size => { document.documentElement.style.fontSize = `${size}%`; }, fontSize);
    await checkBreathingRestart(page, testInfo);
    expectSafeAuthenticatedRequests(mock);
  });
}
}
}
