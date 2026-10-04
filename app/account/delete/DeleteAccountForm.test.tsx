import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), signOut: vi.fn(), getSession: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("../../components/DataExportButton", () => ({ default: () => <button>データを書き出す</button> }));
vi.mock("../../lib/supabaseClient", () => ({ createSupabaseBrowserClient: () => ({ auth: { signOut: mocks.signOut, getSession: mocks.getSession } }) }));
import DeleteAccountForm from "./DeleteAccountForm";
const fetchMock = vi.fn();
const reply = (status: string, extra = {}) => ({ json: async () => ({ status, ...extra }) });
beforeEach(() => {
  localStorage.clear(); vi.stubGlobal("fetch",fetchMock); fetchMock.mockReset();
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "A" } } } });
  mocks.signOut.mockResolvedValue({ error: null });
  localStorage.setItem("favoriteAffirmations:A",'["A data"]');
  localStorage.setItem("favoriteAffirmations:B",'["B data"]');
  localStorage.setItem("daily-affirmation:three-good-things-draft:A",'draft-A');
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); });
function start() { render(<DeleteAccountForm enabled signedIn hasReceipt={false} />); }
async function toReady() {
  fetchMock.mockResolvedValueOnce(reply("pending"));
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button", { name: "メールで本人確認する" }));
  await screen.findByLabelText("確認コード");
  fetchMock.mockResolvedValueOnce(reply("ready"));
  fireEvent.change(screen.getByLabelText("確認コード"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "コードを確認する" }));
  await screen.findByText("最終確認");
}
it("disabled release has no destructive action and makes no request", () => {
  render(<DeleteAccountForm enabled={false} signedIn hasReceipt={false} />);
  expect(screen.getByText(/準備中/)).toBeVisible(); expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.queryByRole("button",{name:"アカウントとデータを削除する"})).not.toBeInTheDocument();
});
it("requires backup choice, then fresh verification and final confirmation", async () => {
  start(); expect(screen.getByRole("button",{name:"メールで本人確認する"})).toBeDisabled();
  await toReady(); expect(screen.getByRole("button",{name:"アカウントとデータを削除する"})).toBeDisabled();
  expect(localStorage.getItem("favoriteAffirmations:A")).not.toBeNull();
});
it("clears only A after confirmed success even when sign-out fails", async () => {
  start(); await toReady(); mocks.signOut.mockRejectedValue(new Error("already deleted"));
  fetchMock.mockResolvedValueOnce(reply("succeeded",{cleanupUserId:"A"}));
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button",{name:"アカウントとデータを削除する"}));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?accountDeleted=1"));
  expect(localStorage.getItem("favoriteAffirmations:A")).toBeNull();
  expect(localStorage.getItem("daily-affirmation:three-good-things-draft:A")).toBeNull();
  expect(localStorage.getItem("favoriteAffirmations:B")).toBe('["B data"]');
});
it("unknown response preserves data, prevents resubmission, and can reconcile", async () => {
  start(); await toReady(); fetchMock.mockRejectedValueOnce(new Error("network"));
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button",{name:"アカウントとデータを削除する"}));
  await screen.findByRole("button",{name:"処理結果を確認する"});
  expect(localStorage.getItem("favoriteAffirmations:A")).not.toBeNull(); expect(mocks.signOut).not.toHaveBeenCalled();
  fetchMock.mockResolvedValueOnce(reply("succeeded",{cleanupUserId:"A"}));
  fireEvent.click(screen.getByRole("button",{name:"処理結果を確認する"}));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
  expect(fetchMock.mock.calls.map(call=>JSON.parse(call[1].body).action)).toEqual(["prepare","verify","delete","status"]);
});
it("restores result using receipt without login and does not sign out current B", async () => {
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "B" } } } });
  fetchMock.mockResolvedValueOnce(reply("succeeded",{cleanupUserId:"A"}));
  render(<DeleteAccountForm enabled signedIn={false} hasReceipt />);
  await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
  expect(mocks.signOut).not.toHaveBeenCalled(); expect(localStorage.getItem("favoriteAffirmations:B")).not.toBeNull();
});
it("cancel after verification invalidates proof and preserves caches", async () => {
  start(); await toReady(); fetchMock.mockResolvedValueOnce(reply("cancelled"));
  fireEvent.click(screen.getByRole("link",{name:"削除せず戻る"}));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard"));
  expect(localStorage.getItem("favoriteAffirmations:A")).not.toBeNull();
});
it("storage failure is reported separately from successful account deletion", async () => {
  start(); await toReady(); vi.spyOn(Storage.prototype,"removeItem").mockImplementation(()=>{throw new Error("blocked");});
  fetchMock.mockResolvedValueOnce(reply("succeeded",{cleanupUserId:"A"}));
  fireEvent.click(screen.getByRole("checkbox")); fireEvent.click(screen.getByRole("button",{name:"アカウントとデータを削除する"}));
  await screen.findByText(/このブラウザーの保存データを消去できませんでした/);
  expect(screen.getByRole("link",{name:"ログイン画面へ"})).toBeVisible();
});
