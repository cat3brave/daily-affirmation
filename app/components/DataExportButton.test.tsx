import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ exportUserData: vi.fn() }));
vi.mock("../exportDataAction", () => ({ exportUserData: mocks.exportUserData }));
import DataExportButton from "./DataExportButton";

const data = {
  schemaVersion: 1 as const,
  exportedAt: "2026-09-27T15:30:00.000Z",
  todos: [], favoriteAffirmations: [], threeGoodThings: [], bloomLogs: [],
};
const originalTimezone = process.env.TZ;

beforeEach(() => {
  process.env.TZ = "Asia/Tokyo";
  mocks.exportUserData.mockReset();
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test-export"), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

describe("DataExportButton", () => {
  it("JSONのMIMEタイプと日付入りファイル名で保存し、URLを解放する", async () => {
    mocks.exportUserData.mockResolvedValue({ status: "success", data });
    let download = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { download = this.download; });
    render(<DataExportButton />);
    fireEvent.click(screen.getByRole("button", { name: "データを書き出す" }));
    expect(await screen.findByRole("status")).toHaveTextContent("書き出しました");
    expect(download).toBe("daily-affirmation-export-2026-09-28.json");
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/json;charset=utf-8");
    expect(JSON.parse(await blob.text())).toEqual(data);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-export");
  });

  it("同期的な連打を1回にし、完了後は再操作できる", async () => {
    let resolve!: (value: { status: "success"; data: typeof data }) => void;
    const pending = new Promise<{ status: "success"; data: typeof data }>((done) => { resolve = done; });
    mocks.exportUserData.mockReturnValueOnce(pending).mockResolvedValue({ status: "success", data });
    render(<DataExportButton />);
    const button = screen.getByRole("button");
    // 同じReactバッチ内で発火し、disabledの再描画に頼らず連打を防ぐ。
    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(mocks.exportUserData).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "書き出し中..." })).toBeDisabled();
    await act(async () => { resolve({ status: "success", data }); await pending; });
    fireEvent.click(screen.getByRole("button", { name: "データを書き出す" }));
    await screen.findByRole("status");
    expect(mocks.exportUserData).toHaveBeenCalledTimes(2);
  });

  it("未認証と取得失敗を安全なalertで案内する", async () => {
    mocks.exportUserData.mockResolvedValueOnce({ status: "auth_required" }).mockResolvedValueOnce({ status: "error" });
    render(<DataExportButton />);
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("alert")).toHaveTextContent("もう一度ログイン");
    expect(screen.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute("href", "/login");
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("alert")).toHaveTextContent("データを書き出せませんでした");
  });

  it.each(["action", "blob", "anchor", "download"])("%sの例外後に安全な通知を表示し、URLを解放して再操作できる", async (failure) => {
    const secret = "private token: raw internal failure";
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warnLog = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    mocks.exportUserData.mockResolvedValue({ status: "success", data });
    render(<DataExportButton />);
    if (failure === "action") mocks.exportUserData.mockRejectedValueOnce(new Error(secret));
    if (failure === "blob") vi.mocked(URL.createObjectURL).mockImplementationOnce(() => { throw new Error(secret); });
    if (failure === "anchor") {
      const createElement = document.createElement.bind(document);
      vi.spyOn(document, "createElement").mockImplementation((tag, options) => {
        if (tag === "a") throw new Error(secret);
        return createElement(tag, options);
      });
    }
    if (failure === "download") vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(() => { throw new Error(secret); });
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /^データを書き出せませんでした。時間をおいてもう一度お試しください。$/,
    );
    expect(document.body).not.toHaveTextContent(secret);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "データを書き出す" })).toBeEnabled();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(failure === "anchor" || failure === "download" ? 1 : 0);
    if (failure === "anchor" || failure === "download") expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-export");
    expect(errorLog).not.toHaveBeenCalled();
    expect(warnLog).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    if (failure === "anchor") vi.mocked(document.createElement).mockRestore();
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("status")).toHaveTextContent("保存済みデータを書き出しました。");
    expect(mocks.exportUserData).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button")).toBeEnabled();
    expect(URL.revokeObjectURL).toHaveBeenLastCalledWith("blob:test-export");
  });
});
