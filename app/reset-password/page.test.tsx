import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), update: vi.fn(), signOut: vi.fn(), onChange: vi.fn(), client: vi.fn(), replace: vi.fn(), unsubscribe: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({ createSupabaseBrowserClient: mocks.client }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
import Page from "./page";
let listener: (event: AuthChangeEvent, session: Session | null) => void;
const user = { data: { user: { id: "user-a" } }, error: null };
afterEach(() => {
  cleanup();
  expect(mocks.unsubscribe).toHaveBeenCalledExactlyOnceWith();
});
beforeEach(() => {
  mocks.getUser.mockResolvedValue(user);
  mocks.update.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.onChange.mockImplementation((callback) => { listener = callback; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }; });
  mocks.client.mockReturnValue({ auth: { getUser: mocks.getUser, updateUser: mocks.update, signOut: mocks.signOut, onAuthStateChange: mocks.onChange } });
});
async function ready() { render(<Page />); await waitFor(() => expect(screen.getByRole("button", { name: "パスワードを更新する" })).toBeEnabled()); }
function fill(password = "  raw password 日本語  ", confirmation = password) {
  fireEvent.change(screen.getByLabelText("新しいパスワード", { exact: true }), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("新しいパスワード（確認）"), { target: { value: confirmation } });
}
function submit() { fireEvent.submit(screen.getByRole("button", { name: /パスワードを更新する|更新中/ }).closest("form")!); }
function deferred<T>() { let resolve!: (v: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { resolve, promise }; }
it("認証確認中に更新できない", () => {
  mocks.getUser.mockReturnValue(new Promise(() => {})); render(<Page />);
  fill(); submit(); expect(mocks.update).not.toHaveBeenCalled();
  expect(screen.getByLabelText("新しいパスワード", { exact: true })).toBeDisabled();
});
it.each(["missing", "error", "exception"])("認証 %s で更新しない", async (mode) => {
  if (mode === "exception") mocks.getUser.mockRejectedValue(new Error("private-token"));
  else mocks.getUser.mockResolvedValue({ data: { user: mode === "missing" ? null : user.data.user }, error: mode === "error" ? new Error("private-token") : null });
  render(<Page />); expect(await screen.findByRole("alert")).toHaveTextContent("ログイン情報を確認できません");
  expect(mocks.update).not.toHaveBeenCalled(); expect(document.body).not.toHaveTextContent("private-token");
});
it.each([["", ""], ["password", "different"]])("空・不一致を検証する %s", async (a, b) => {
  await ready(); fill(a, b); submit();
  expect(screen.getByRole("alert")).toHaveTextContent(/入力|一致/); expect(mocks.update).not.toHaveBeenCalled();
});
it("入力値をそのまま渡し、入力を消し、localセッションを終了してログインへ戻る", async () => {
  await ready(); fill(); submit();
  expect(await screen.findByRole("button", { name: "ログイン画面へ戻る" })).toBeEnabled();
  expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ password: "  raw password 日本語  " });
  expect(mocks.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  expect(screen.queryByLabelText("新しいパスワード", { exact: true })).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("このブラウザーからログアウト");
  expect(document.body).not.toHaveTextContent("全セッション");
  fireEvent.click(screen.getByRole("button", { name: "ログイン画面へ戻る" })); expect(mocks.replace).toHaveBeenCalledWith("/login");
});
it.each(["rejected", "exception"])("更新 %s 後も入力を保持し再操作でき、内部情報を露出しない", async (mode) => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  if (mode === "exception") mocks.update.mockRejectedValueOnce(new Error("private-token"));
  else mocks.update.mockResolvedValueOnce({ error: { message: "private-token", code: "weak_password" } });
  await ready(); fill(); submit();
  expect(await screen.findByRole("alert")).toHaveTextContent("更新できませんでした");
  await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
  expect(screen.getByLabelText("新しいパスワード", { exact: true })).toHaveValue("  raw password 日本語  ");
  expect(document.body).not.toHaveTextContent("private-token"); expect(log).not.toHaveBeenCalled();
  expect(mocks.signOut).not.toHaveBeenCalled(); submit();
  await screen.findByRole("button", { name: "ログイン画面へ戻る" }); expect(mocks.update).toHaveBeenCalledTimes(2);
});
it("連続更新を抑止する", async () => {
  const pending = deferred<{ error: null }>(); mocks.update.mockReturnValue(pending.promise);
  await ready(); fill(); submit(); submit(); submit();
  await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
  expect(screen.getByLabelText("新しいパスワード", { exact: true })).toBeDisabled();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  await act(async () => pending.resolve({ error: null }));
  expect(mocks.update).toHaveBeenCalledTimes(1);
});
it.each(["error", "exception", "verification"])("更新成功とログアウト %s を区別し更新を二重実行しない", async (mode) => {
  if (mode === "error") mocks.signOut.mockResolvedValueOnce({ error: new Error("secret") });
  if (mode === "exception") mocks.signOut.mockRejectedValueOnce(new Error("secret"));
  if (mode === "verification") mocks.getUser.mockResolvedValueOnce(user).mockResolvedValueOnce(user).mockResolvedValueOnce({ data: { user: null }, error: new Error("secret") });
  await ready(); fill(); submit();
  expect(await screen.findByRole("alert")).toHaveTextContent("パスワードは更新されましたが");
  const retry = screen.getByRole("button", { name: "ログアウトを再試行する" });
  await waitFor(() => expect(retry).toBeEnabled()); fireEvent.click(retry); fireEvent.click(retry);
  await screen.findByRole("button", { name: "ログイン画面へ戻る" });
  expect(mocks.update).toHaveBeenCalledTimes(1); expect(document.body).not.toHaveTextContent("secret");
});
it("更新直前のgetUserが別ユーザーなら更新しない", async () => {
  await ready(); mocks.getUser.mockResolvedValue({ data: { user: { id: "user-b" } }, error: null }); fill(); submit();
  expect(await screen.findByRole("alert")).toHaveTextContent("ログイン情報を確認できません"); expect(mocks.update).not.toHaveBeenCalled();
});
it.each(["user-change", "signout", "unmount"])("更新中の %s 後の古い成功応答を反映しない", async (mode) => {
  const pending = deferred<{ error: null }>(); mocks.update.mockReturnValue(pending.promise);
  const view = render(<Page />); await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
  fill(); submit(); await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
  if (mode === "unmount") view.unmount();
  else act(() => listener(mode === "signout" ? "SIGNED_OUT" : "SIGNED_IN", mode === "signout" ? null : { user: { id: "user-b" } } as Session));
  await act(async () => pending.resolve({ error: null }));
  expect(screen.queryByText("パスワードの更新完了")).not.toBeInTheDocument(); expect(mocks.signOut).not.toHaveBeenCalled();
  if (mode === "unmount") expect(mocks.unsubscribe).toHaveBeenCalled();
});
it("確認中のログアウト後に古いgetUser応答を反映しない", async () => {
  const pending = deferred<typeof user>(); mocks.getUser.mockReturnValue(pending.promise); render(<Page />);
  act(() => listener("SIGNED_OUT", null)); await act(async () => pending.resolve(user));
  expect(screen.queryByRole("button")).not.toBeInTheDocument(); expect(mocks.update).not.toHaveBeenCalled();
});
it("自身のログアウトイベントは完了案内を消さない", async () => {
  mocks.signOut.mockImplementation(async () => { listener("SIGNED_OUT", null); return { error: null }; });
  await ready(); fill(); submit(); await screen.findByRole("button", { name: "ログイン画面へ戻る" });
});
it("初期確認中の利用者変更で古い認証を採用しない", async () => {
  const pending = deferred<typeof user>(); mocks.getUser.mockReturnValue(pending.promise); render(<Page />);
  act(() => listener("SIGNED_IN", { user: { id: "user-b" } } as Session));
  await act(async () => pending.resolve(user));
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("SSR Cookie復元のSIGNED_INだけでは認証せず、getUserで同じ本人を確認する", async () => {
  const pending = deferred<typeof user>(); mocks.getUser.mockReturnValue(pending.promise); render(<Page />);
  act(() => listener("SIGNED_IN", { user: { id: "user-a" } } as Session));
  expect(screen.getByRole("button", { name: "パスワードを更新する" })).toBeDisabled();
  expect(mocks.update).not.toHaveBeenCalled();
  await act(async () => pending.resolve(user));
  expect(screen.getByRole("button", { name: "パスワードを更新する" })).toBeEnabled();
});
it("ログアウト処理中の利用者変更後に完了を反映しない", async () => {
  const pending = deferred<{ error: null }>(); mocks.signOut.mockReturnValue(pending.promise);
  await ready(); fill(); submit(); await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
  act(() => listener("SIGNED_IN", { user: { id: "user-b" } } as Session));
  await act(async () => pending.resolve({ error: null }));
  expect(screen.queryByRole("button", { name: "ログイン画面へ戻る" })).not.toBeInTheDocument();
});
