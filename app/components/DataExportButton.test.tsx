import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DataExportButton from "./DataExportButton";

const filename = "daily-affirmation-data-2026-09-27.json";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
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

describe("DataExportButton", () => {
  it("処理中は無効化し、同期的な連打でも通信とダウンロードを1回にする", async () => {
    let resolveFetch!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => { resolveFetch = resolve; });
    vi.mocked(fetch).mockReturnValue(pending);
    render(<DataExportButton />);
    const button = screen.getByRole("button", { name: "データを書き出す" });

    fireEvent.click(button);
    fireEvent.click(button);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "書き出し中..." })).toBeDisabled();

    await act(async () => {
      resolveFetch(new Response("{}", { headers: { "Content-Disposition": `attachment; filename="${filename}"` } }));
      await pending;
    });
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-export");
    expect(screen.getByRole("status")).toHaveTextContent("保存済みデータを書き出しました。");
    expect(screen.getByRole("button", { name: "データを書き出す" })).toBeEnabled();
  });

  it("失敗時はalertを表示して再試行できる", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockResolvedValueOnce(new Response("{}", { headers: { "Content-Disposition": `attachment; filename="${filename}"` } }));
    render(<DataExportButton />);

    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("alert")).toHaveTextContent("データを書き出せませんでした");
    expect(screen.getByRole("button")).toBeEnabled();
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("status")).toHaveTextContent("書き出しました");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("セッション切れでは再ログイン案内とリンクを表示する", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 401 }));
    render(<DataExportButton />);
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("alert")).toHaveTextContent("セッションが切れました");
    expect(screen.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute("href", "/login");
  });
});
