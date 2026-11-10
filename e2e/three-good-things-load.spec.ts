import { test } from "@playwright/test";
import { checkBoundedGoodThingsLoad } from "./support/goodThingsLoad";

test.use({ timezoneId: "Asia/Tokyo" });
test("大量の過去記録でも今日を取得し、日付変更と再試行で保存状態を保つ", async ({ page }) => {
  await checkBoundedGoodThingsLoad(page);
});
