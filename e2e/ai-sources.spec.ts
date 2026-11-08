import { test } from "@playwright/test";
import { checkAiSources } from "./support/aiSources";
import { loginToDashboard, stubExternalServices } from "./support/supabaseMock";

// Both features, retries and six captures are exercised in each case.
test.setTimeout(60_000);

for (const width of [320, 1280]) {
  for (const enlarged of [false, true]) {
    test(`AI source labels and retries: ${width}px, enlarged=${enlarged} (mock actions)`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 720 });
      await stubExternalServices(page);
      await loginToDashboard(page);
      if (enlarged) await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
      await checkAiSources(page, info);
    });
  }
}
