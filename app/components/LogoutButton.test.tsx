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
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LogoutButton", () => {
  it("ログアウト成功時にsignOutを呼びloginへ遷移してrefreshする", async () => {
    const signOutDeferred = createDeferred<SignOutResult>();
    logoutMocks.signOut.mockReturnValue(signOutDeferred.promise);
    const { rerender } = render(<LogoutButton />);

    fireEvent.click(screen.getByRole("button"));

    await screen.findByText("ログアウト中...");
    rerender(<LogoutButton />);
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
    render(<LogoutButton />);

    fireEvent.click(screen.getByRole("button"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      LOGOUT_ERROR_MESSAGE,
    );
    const button = screen.getByRole("button");
    expect(button).toBeEnabled();
    expect(logoutMocks.push).not.toHaveBeenCalled();
    expect(logoutMocks.refresh).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "ログアウトに失敗しました:",
      error,
    );
  });

  it("signOutがthrowしても外へ伝播させずエラー表示を出して再操作可能に戻る", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const error = new Error("sign out exploded");
    logoutMocks.signOut.mockRejectedValue(error);
    render(<LogoutButton />);

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
      "ログアウト中に想定外のエラー:",
      error,
    );
  });

  it("ログアウト処理中はボタンがdisabledになり連続クリックでもsignOutを1回だけ呼ぶ", async () => {
    const signOutDeferred = createDeferred<SignOutResult>();
    logoutMocks.signOut.mockReturnValue(signOutDeferred.promise);
    render(<LogoutButton />);

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
});
