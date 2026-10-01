import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ exportUserData: vi.fn() }));
vi.mock("../exportDataAction", () => ({ exportUserData: mocks.exportUserData }));
import DataExportButton from "./DataExportButton";

const data = {
  schemaVersion: 1 as const,
  exportedAt: "2026-09-27T12:00:00.000Z",
  todos: [], favoriteAffirmations: [], threeGoodThings: [], bloomLogs: [],
};
const safeErrorMessage = "データを書き出せませんでした。時間をおいてもう一度お試しください。";

beforeEach(() => {
  mocks.exportUserData.mockReset();
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn(() => "blob:test-export"),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function expectRecoverableSafeFailure(secret: string) {
  const button = screen.getByRole("button", { name: "データを書き出す" });
  fireEvent.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent(safeErrorMessage);
  expect(screen.queryByText(new RegExp(secret, "i"))).not.toBeInTheDocument();
  expect(button).toBeEnabled();
}

describe("DataExportButton", () => {
  it("JSONのMIMEタイプと現地日付入りファイル名で保存し、URLを解放する", async () => {
    mocks.exportUserData.mockResolvedValue({ status: "success", data });
    let download = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      download = this.download;
    });
    render(<DataExportButton />);
    fireEvent.click(screen.getByRole("button", { name: "データを書き出す" }));
    expect(await screen.findByRole("status")).toHaveTextContent("書き出しました");
    expect(download).toBe("daily-affirmation-export-2026-09-27.json");
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
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.exportUserData).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "書き出し中..." })).toBeDisabled();
    await act(async () => {
      resolve({ status: "success", data });
      await pending;
    });
    fireEvent.click(screen.getByRole("button", { name: "データを書き出す" }));
    await waitFor(() => expect(mocks.exportUserData).toHaveBeenCalledTimes(2));
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

  it("Server Action例外でも生の例外を表示・記録せず再操作できる", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.exportUserData.mockRejectedValue(new Error("server action secret"));
    render(<DataExportButton />);
    await expectRecoverableSafeFailure("server action secret");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("Blob URL生成失敗でも生の例外を表示・記録せず再操作できる", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.exportUserData.mockResolvedValue({ status: "success", data });
    vi.mocked(URL.createObjectURL).mockImplementation(() => { throw new Error("blob secret"); });
    render(<DataExportButton />);
    await expectRecoverableSafeFailure("blob secret");
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("ダウンロード操作失敗でもURLを解放し、生の例外を表示・記録せず再操作できる", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.exportUserData.mockResolvedValue({ status: "success", data });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
      throw new Error("download secret");
    });
    render(<DataExportButton />);
    await expectRecoverableSafeFailure("download secret");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-export");
    expect(consoleError).not.toHaveBeenCalled();
  });
});
