import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Session = { user: { id: string } };
type SupabaseError = { message: string };
type GetSessionResult = {
  data: { session: Session | null };
  error: SupabaseError | null;
};
type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

const pageMocks = vi.hoisted(() => {
  const push = vi.fn<(path: string) => void>();
  const useRouter = vi.fn(() => ({ push }));
  const getSession = vi.fn<() => Promise<GetSessionResult>>();
  const createSupabaseBrowserClient = vi.fn(() => ({
    auth: { getSession },
  }));

  return {
    createSupabaseBrowserClient,
    getSession,
    push,
    useRouter,
  };
});

vi.mock("next/navigation", () => ({
  useRouter: pageMocks.useRouter,
}));

vi.mock("./lib/supabaseClient", () => ({
  createSupabaseBrowserClient: pageMocks.createSupabaseBrowserClient,
}));

import LandingPage from "./page";

const LOADING_MESSAGE = "心の準備をしています...🌷";

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

function createGetSessionResult(session: Session | null): GetSessionResult {
  return {
    data: { session },
    error: null,
  };
}

function configurePageMock() {
  pageMocks.createSupabaseBrowserClient.mockReset();
  pageMocks.getSession.mockReset();
  pageMocks.push.mockReset();
  pageMocks.useRouter.mockReset();

  pageMocks.useRouter.mockReturnValue({ push: pageMocks.push });
  pageMocks.createSupabaseBrowserClient.mockReturnValue({
    auth: { getSession: pageMocks.getSession },
  });
  pageMocks.getSession.mockResolvedValue(createGetSessionResult(null));
}

beforeEach(() => {
  configurePageMock();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LandingPage", () => {
  it("初期表示で心の準備をしていますのstatusを表示する", async () => {
    const getSessionDeferred = createDeferred<GetSessionResult>();
    pageMocks.getSession.mockReturnValue(getSessionDeferred.promise);

    render(<LandingPage />);

    expect(screen.getByRole("status")).toHaveTextContent(LOADING_MESSAGE);

    await act(async () => {
      getSessionDeferred.resolve(createGetSessionResult(null));
      await getSessionDeferred.promise;
    });
  });

  it("sessionがある場合にdashboardへ遷移する", async () => {
    pageMocks.getSession.mockResolvedValue(
      createGetSessionResult({ user: { id: "user-1" } }),
    );

    render(<LandingPage />);

    await waitFor(() => expect(pageMocks.push).toHaveBeenCalledTimes(1));
    expect(pageMocks.push).toHaveBeenCalledWith("/dashboard");
    expect(pageMocks.push).not.toHaveBeenCalledWith("/login");
  });

  it("sessionがない場合にloginへ遷移する", async () => {
    pageMocks.getSession.mockResolvedValue(createGetSessionResult(null));

    render(<LandingPage />);

    await waitFor(() => expect(pageMocks.push).toHaveBeenCalledTimes(1));
    expect(pageMocks.push).toHaveBeenCalledWith("/login");
    expect(pageMocks.push).not.toHaveBeenCalledWith("/dashboard");
  });

  it("getSessionがerrorを返した場合console.errorを呼びloginへ遷移する", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const error = { message: "session failed" };
    pageMocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error,
    });

    render(<LandingPage />);

    await waitFor(() => expect(pageMocks.push).toHaveBeenCalledTimes(1));
    expect(consoleError).toHaveBeenCalledWith(
      "セッション確認に失敗しました:",
      error,
    );
    expect(pageMocks.push).toHaveBeenCalledWith("/login");
    expect(pageMocks.push).not.toHaveBeenCalledWith("/dashboard");
  });

  it("getSessionがthrowした場合例外を伝播させずloginへ遷移する", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const error = new Error("session exploded");
    pageMocks.getSession.mockRejectedValue(error);

    let renderError: unknown;
    try {
      render(<LandingPage />);
    } catch (caughtError) {
      renderError = caughtError;
    }

    await waitFor(() => expect(pageMocks.push).toHaveBeenCalledTimes(1));
    expect(renderError).toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "セッション確認中に想定外のエラー:",
      error,
    );
    expect(pageMocks.push).toHaveBeenCalledWith("/login");
    expect(pageMocks.push).not.toHaveBeenCalledWith("/dashboard");
  });

  it("getSession完了前にアンマウントした場合完了後も遷移しない", async () => {
    const getSessionDeferred = createDeferred<GetSessionResult>();
    pageMocks.getSession.mockReturnValue(getSessionDeferred.promise);
    const { unmount } = render(<LandingPage />);

    expect(pageMocks.getSession).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      getSessionDeferred.resolve(
        createGetSessionResult({ user: { id: "user-1" } }),
      );
      await getSessionDeferred.promise;
    });

    expect(pageMocks.push).not.toHaveBeenCalled();
  });

  it("再レンダーしてもSupabaseクライアントを再作成しない", async () => {
    const getSessionDeferred = createDeferred<GetSessionResult>();
    pageMocks.getSession.mockReturnValue(getSessionDeferred.promise);
    const { rerender } = render(<LandingPage />);

    expect(pageMocks.createSupabaseBrowserClient).toHaveBeenCalledTimes(1);
    expect(pageMocks.getSession).toHaveBeenCalledTimes(1);

    rerender(<LandingPage />);

    expect(pageMocks.createSupabaseBrowserClient).toHaveBeenCalledTimes(1);
    expect(pageMocks.getSession).toHaveBeenCalledTimes(1);

    await act(async () => {
      getSessionDeferred.resolve(createGetSessionResult(null));
      await getSessionDeferred.promise;
    });
  });
});
