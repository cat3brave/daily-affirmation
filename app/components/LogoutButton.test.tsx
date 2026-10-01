import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SupabaseError = { message: string };
type SignOutResult = {
  error: SupabaseError | null;
};
type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const logoutMocks = vi.hoisted(() => {
  const push = vi.fn<(path: string) => void>();
  const refresh = vi.fn<() => void>();
  const useRouter = vi.fn(() => ({ push, refresh }));
  const signOut = vi.fn<() => Promise<SignOutResult>>();
  const createSupabaseBrowserClient = vi.fn(() => ({
    auth: { signOut },
  }));

  return {
    createSupabaseBrowserClient,
    push,
    refresh,
    signOut,
    useRouter,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: logoutMocks.useRouter,
}));

vi.mock("@/app/lib/supabaseClient", () => ({
  createSupabaseBrowserClient: logoutMocks.createSupabaseBrowserClient,
}));

import LogoutButton from "./LogoutButton";
import {
  getFavoriteAffirmationsStorageKey,
  getThreeGoodThingsDraftKey,
} from "../lib/userLocalStorage";

const LOGOUT_ERROR_MESSAGE =
  "ログアウトに失敗しました。もう一度お試しください。";

function createDeferred<T>(): Deferred<T> {
  let resolve: Deferred<T>["resolve"] | undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  if (!resolve) {
    throw new Error("Deferred promise was not initialized.");
  }

  return { promise, resolve };
}

function configureLogoutMock() {
  logoutMocks.createSupabaseBrowserClient.mockReset();
  logoutMocks.push.mockReset();
  logoutMocks.refresh.mockReset();
  logoutMocks.signOut.mockReset();
  logoutMocks.useRouter.mockReset();

  logoutMocks.useRouter.mockReturnValue({
    push: logoutMocks.push,
    refresh: logoutMocks.refresh,
  });
  logoutMocks.createSupabaseBrowserClient.mockReturnValue({
    auth: { signOut: logoutMocks.signOut },
  });
  logoutMocks.signOut.mockResolvedValue({ error: null });
}

beforeEach(() => {
  configureLogoutMock();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LogoutButton", () => {
  it("ログアウトボタンはフォームを送信しないbutton型で表示する", () => {
    render(<LogoutButton userId="current-user" />);

    expect(
      screen.getByRole("button", { name: "👋 ログアウト" }),
    ).toHaveAttribute("type", "button");
  });

  it("ログアウト成功時にsignOutを呼びloginへ遷移してrefreshする", async () => {
    const signOutDeferred = createDeferred<SignOutResult>();
    logoutMocks.signOut.mockReturnValue(signOutDeferred.promise);
    const { rerender } = render(<LogoutButton userId="current-user" />);

    fireEvent.click(screen.getByRole("button"));

    await screen.findByText("ログアウト中...");
    rerender(<LogoutButton userId="current-user" />);
    expect(logoutMocks.createSupabaseBrowserClient).toHaveBeenCalledTimes(1);

    await act(async () => {
      signOutDeferred.resolve({ error: null });
      await signOutDeferred.promise;
    });

    expect(logoutMocks.signOut).toHaveBeenCalledTimes(1);
    expect(logoutMocks.push).toHaveBeenCalledWith("/login");
    expect(logoutMocks.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("signOutがerrorを返した場合はエラー表示を出し遷移せず再操作可能に戻る", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const error = { message: "sign out failed" };
    logoutMocks.signOut.mockResolvedValue({ error });
    render(<LogoutButton userId="current-user" />);

    fireEvent.click(screen.getByRole("button"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      LOGOUT_ERROR_MESSAGE,
    );
    const button = screen.getByRole("button");
    expect(button).toBeEnabled();
    expect(logoutMocks.push).not.toHaveBeenCalled();
    expect(logoutMocks.refresh).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("ログアウトに失敗しました。");
    expect(consoleError).not.toHaveBeenCalledWith(expect.anything(), error);
  });

  it("signOutがthrowしても外へ伝播させずエラー表示を出して再操作可能に戻る", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const error = new Error("sign out exploded");
    logoutMocks.signOut.mockRejectedValue(error);
    render(<LogoutButton userId="current-user" />);

    let clickError: unknown;
    try {
      fireEvent.click(screen.getByRole("button"));
    } catch (caughtError) {
      clickError = caughtError;
    }

    expect(await screen.findByRole("alert")).toHaveTextContent(
      LOGOUT_ERROR_MESSAGE,
    );
    expect(clickError).toBeUndefined();
    expect(screen.getByRole("button")).toBeEnabled();
    expect(logoutMocks.push).not.toHaveBeenCalled();
    expect(logoutMocks.refresh).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "ログアウト中に想定外のエラーが発生しました。",
    );
    expect(consoleError).not.toHaveBeenCalledWith(expect.anything(), error);
  });

  it("ログアウト処理中はボタンがdisabledになり連続クリックでもsignOutを1回だけ呼ぶ", async () => {
    const signOutDeferred = createDeferred<SignOutResult>();
    logoutMocks.signOut.mockReturnValue(signOutDeferred.promise);
    render(<LogoutButton userId="current-user" />);

    fireEvent.click(screen.getByRole("button"));
    const button = await screen.findByRole("button", {
      name: "ログアウト中...",
    });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(logoutMocks.signOut).toHaveBeenCalledTimes(1);

    await act(async () => {
      signOutDeferred.resolve({ error: null });
      await signOutDeferred.promise;
    });

    expect(logoutMocks.push).toHaveBeenCalledWith("/login");
    expect(logoutMocks.refresh).toHaveBeenCalled();
  });

  it("下書きがある場合だけ確認し、キャンセル時は何も変更しない", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const favoriteKey = getFavoriteAffirmationsStorageKey("current-user");
    const draftKey = getThreeGoodThingsDraftKey("current-user");
    localStorage.setItem(favoriteKey, '["お気に入り"]');
    localStorage.setItem(draftKey, JSON.stringify({ things: ["利用者の下書き", "", ""] }));
    render(<LogoutButton userId="current-user" />);
    fireEvent.click(screen.getByRole("button"));
    expect(confirm).toHaveBeenCalledWith("ログアウトすると、この端末の未保存の下書きが削除されます。ログアウトしますか？");
    expect(logoutMocks.signOut).not.toHaveBeenCalled();
    expect(localStorage.getItem(favoriteKey)).toBe('["お気に入り"]');
    expect(localStorage.getItem(draftKey)).toContain("利用者の下書き");
    expect(logoutMocks.push).not.toHaveBeenCalled();
  });

  it("下書きがなければ確認せず、成功後に消去してから遷移する", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const currentKeys = [getFavoriteAffirmationsStorageKey("current-user"), getThreeGoodThingsDraftKey("current-user")];
    const otherKeys = [getFavoriteAffirmationsStorageKey("other-user"), getThreeGoodThingsDraftKey("other-user")];
    [...currentKeys, ...otherKeys].forEach((key) => localStorage.setItem(key, "saved"));
    localStorage.setItem(currentKeys[1], JSON.stringify({ things: [" ", "", ""] }));
    logoutMocks.push.mockImplementation(() => {
      expect(currentKeys.map((key) => localStorage.getItem(key))).toEqual([null, null]);
    });
    render(<LogoutButton userId="current-user" />);
    fireEvent.click(screen.getByRole("button"));
    await screen.findByRole("button", { name: "👋 ログアウト" });
    expect(confirm).not.toHaveBeenCalled();
    expect(otherKeys.map((key) => localStorage.getItem(key))).toEqual(["saved", "saved"]);
    expect(logoutMocks.push).toHaveBeenCalledWith("/login");
  });

  it.each(["error", "throw"])("signOut %s時はユーザーデータを残す", async (failure) => {
    const key = getFavoriteAffirmationsStorageKey("current-user");
    localStorage.setItem(key, "private-cache");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    if (failure === "error") logoutMocks.signOut.mockResolvedValue({ error: { message: "secret error" } });
    else logoutMocks.signOut.mockRejectedValue(new Error("secret thrown error"));
    render(<LogoutButton userId="current-user" />);
    fireEvent.click(screen.getByRole("button"));
    await screen.findByRole("alert");
    expect(localStorage.getItem(key)).toBe("private-cache");
    expect(logoutMocks.push).not.toHaveBeenCalled();
  });

  it("localStorage削除例外時もログアウトと遷移を完了する", async () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new DOMException("private", "SecurityError"); });
    const consoleError = vi.spyOn(console, "error");
    render(<LogoutButton userId="current-user" />);
    fireEvent.click(screen.getByRole("button"));
    await screen.findByRole("button", { name: "👋 ログアウト" });
    expect(logoutMocks.push).toHaveBeenCalledWith("/login");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("state更新前の同期的な連打でもsignOutを1回だけ呼ぶ", () => {
    logoutMocks.signOut.mockReturnValue(createDeferred<SignOutResult>().promise);
    render(<LogoutButton userId="current-user" />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(logoutMocks.signOut).toHaveBeenCalledTimes(1);
  });
});
