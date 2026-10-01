import { afterEach, describe, expect, it, vi } from "vitest";
import { formatExportLocalDate } from "./dataExportDate";

afterEach(() => vi.restoreAllMocks());

describe("formatExportLocalDate", () => {
  it("UTC日付ではなくブラウザーの現地日付をYYYY-MM-DDにする", () => {
    const exportedAt = "2026-09-30T15:30:00.000Z";
    expect(exportedAt.slice(0, 10)).toBe("2026-09-30");

    vi.spyOn(Date.prototype, "getFullYear").mockReturnValue(2026);
    vi.spyOn(Date.prototype, "getMonth").mockReturnValue(9);
    vi.spyOn(Date.prototype, "getDate").mockReturnValue(1);

    expect(formatExportLocalDate(exportedAt)).toBe("2026-10-01");
  });
});
