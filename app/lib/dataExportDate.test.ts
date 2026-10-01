import { afterEach, describe, expect, it } from "vitest";
import { formatExportLocalDate } from "./dataExportDate";

const originalTimezone = process.env.TZ;
afterEach(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

describe("formatExportLocalDate", () => {
  it.each([
    ["Asia/Tokyo", "2026-09-27T15:30:00.000Z", "2026-09-28"],
    ["America/Los_Angeles", "2026-09-28T01:30:00.000Z", "2026-09-27"],
    ["UTC", "2026-09-27T15:30:00.000Z", "2026-09-27"],
    ["Asia/Tokyo", "2026-12-31T15:00:00.000Z", "2027-01-01"],
    ["America/Los_Angeles", "2026-01-01T01:00:00.000Z", "2025-12-31"],
  ])("%sで%sを現地日付%sにする", (timezone, timestamp, expected) => {
    process.env.TZ = timezone;
    expect(formatExportLocalDate(timestamp)).toBe(expected);
  });
});
