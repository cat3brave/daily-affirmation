import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
const mocks = vi.hoisted(() => ({ reset: vi.fn(), client: vi.fn() }));
vi.mock("../lib/supabaseClient", () => ({ createSupabaseBrowserClient: mocks.client }));
import Page from "./page";
afterEach(cleanup);
beforeEach(() => {
  mocks.client.mockReturnValue({ auth: { resetPasswordForEmail: mocks.reset } });
  mocks.reset.mockResolvedValue({ error: null });
});
function send(email = "  person@example.test  ") {
  fireEvent.change(screen.getByLabelText("メールアドレス"), { target: { value: email } });
  fireEvent.submit(screen.getByRole("button", { name: "復旧メールを依頼する" }).closest("form")!);
}
it("hydration前のHTMLでは入力と送信を無効にし、入力の消失を防ぐ", () => {
  const html = renderToString(<Page />);
  expect(html).toMatch(/<input[^>]*disabled=""/);
  expect(html).toMatch(/<button[^>]*disabled=""/);
  expect(mocks.reset).not.toHaveBeenCalled();
});
it.each(["", "   ", "invalid", "a@b", "a b@example.test"])("不正入力 %s は送信しない", async (email) => {
  render(<Page />); send(email);
  expect(screen.getByRole("alert")).toHaveTextContent(/入力|形式/);
  expect(screen.getByLabelText("メールアドレス")).toHaveFocus();
  expect(mocks.reset).not.toHaveBeenCalled();
});
it("前後の空白を取り除き固定callbackを指定し、登録の有無を示さない", async () => {
  render(<Page />); send();
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("登録されているメールアドレスの場合"));
  expect(mocks.reset).toHaveBeenCalledWith("person@example.test", { redirectTo: "http://localhost/auth/recovery" });
  expect(screen.getByRole("link", { name: "ログイン画面へ戻る" })).toHaveAttribute("href", "/login");
});
it.each(["network", "limit", "exception"])("%s の内部情報を隠し、再操作できる", async (mode) => {
  const secret = "private-token-and-link";
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  if (mode === "exception") mocks.reset.mockRejectedValueOnce(new Error(secret));
  else mocks.reset.mockResolvedValueOnce({ error: { status: mode === "limit" ? 429 : 500, message: secret } });
  render(<Page />); send();
  expect(await screen.findByRole("alert")).toHaveTextContent(mode === "limit" ? "制限" : "依頼できませんでした");
  await waitFor(() => expect(screen.getByRole("button")).toBeEnabled());
  expect(document.body).not.toHaveTextContent(secret); expect(log).not.toHaveBeenCalled();
  send(); await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("登録されているメールアドレスの場合"));
  expect(mocks.reset).toHaveBeenCalledTimes(2);
});
it("同期の連続submitを抑止し、処理中は入力と戻る操作を無効化する", async () => {
  let resolve!: (value: { error: null }) => void;
  mocks.reset.mockReturnValue(new Promise((r) => { resolve = r; }));
  render(<Page />); send();
  const form = screen.getByRole("button").closest("form")!;
  fireEvent.submit(form); fireEvent.submit(form);
  expect(mocks.reset).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("メールアドレス")).toBeDisabled();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  await act(async () => resolve({ error: null }));
  expect(screen.getByRole("button")).toBeEnabled();
});
it("アンマウント後の結果は反映しない", async () => {
  let resolve!: (value: { error: null }) => void;
  mocks.reset.mockReturnValue(new Promise((r) => { resolve = r; }));
  const view = render(<Page />); send(); view.unmount();
  await act(async () => resolve({ error: null }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
