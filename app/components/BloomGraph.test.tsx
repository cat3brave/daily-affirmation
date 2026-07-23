import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SupabaseError = { message: string };
type SessionResult = {
  data: {
    session: {
      user: {
        id: string;
      };
    } | null;
  };
  error: SupabaseError | null;
};
type BloomLog = {
  created_at: string;
};
type BloomLogsResult = {
  data: BloomLog[] | null;
  error: SupabaseError | null;
};
type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

const supabaseMocks = vi.hoisted(() => {
  const getSession = vi.fn<() => Promise<SessionResult>>();
  const gte = vi.fn<
    (column: string, value: string) => Promise<BloomLogsResult>
  >();
  const eq = vi.fn<(column: string, value: string) => { gte: typeof gte }>();
  const select = vi.fn<(columns: string) => { eq: typeof eq }>();
  const from = vi.fn<(table: string) => { select: typeof select }>();
  const createSupabaseBrowserClient = vi.fn(() => ({
    auth: { getSession },
    from,
  }));

  return {
    createSupabaseBrowserClient,
    eq,
    from,
    getSession,
    gte,
    select,
  };
});

vi.mock("../lib/supabaseClient", () => ({
  createSupabaseBrowserClient: supabaseMocks.createSupabaseBrowserClient,
}));

import BloomGraph from "./BloomGraph";

const USER_ID = "user-bloom-1";
const LOADING_MESSAGE = "成長記録を読み込み中...🌱";
const LOAD_ERROR_MESSAGE =
  "お花の成長記録を読み込めませんでした。時間をおいて、もう一度お試しください。";

function createDeferred<T>(): Deferred<T> {
  let resolve: Deferred<T>["resolve"] | undefined;
  let reject: Deferred<T>["reject"] | undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  if (!resolve || !reject) {
    throw new Error("Deferred promise was not initialized.");
  }

  return { promise, reject, resolve };
}

function createSessionResult(userId = USER_ID): SessionResult {
  return {
    data: {
      session: {
        user: {
          id: userId,
        },
      },
    },
    error: null,
  };
}

function createSessionErrorResult(error: SupabaseError): SessionResult {
  return {
    data: {
      session: null,
    },
    error,
  };
}

function createBloomLogsResult(data: BloomLog[] = []): BloomLogsResult {
  return {
    data,
    error: null,
  };
}

function configureSupabaseMock({
  bloomLogsResult = createBloomLogsResult(),
  getSessionException,
  sessionResult = createSessionResult(),
  gteException,
}: {
  bloomLogsResult?: BloomLogsResult;
  getSessionException?: Error;
  sessionResult?: SessionResult;
  gteException?: Error;
} = {}) {
  supabaseMocks.createSupabaseBrowserClient.mockReset();
  supabaseMocks.getSession.mockReset();
  supabaseMocks.from.mockReset();
  supabaseMocks.select.mockReset();
  supabaseMocks.eq.mockReset();
  supabaseMocks.gte.mockReset();

  supabaseMocks.createSupabaseBrowserClient.mockReturnValue({
    auth: { getSession: supabaseMocks.getSession },
    from: supabaseMocks.from,
  });
  supabaseMocks.getSession.mockImplementation(async () => {
    if (getSessionException) {
      throw getSessionException;
    }

    return sessionResult;
  });
  supabaseMocks.from.mockReturnValue({ select: supabaseMocks.select });
  supabaseMocks.select.mockReturnValue({ eq: supabaseMocks.eq });
  supabaseMocks.eq.mockReturnValue({ gte: supabaseMocks.gte });
  supabaseMocks.gte.mockImplementation(async () => {
    if (gteException) {
      throw gteException;
    }

    return bloomLogsResult;
  });
}

function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createPastLocalNoonDate() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  date.setHours(12, 0, 0, 0);

  return date;
}

beforeEach(() => {
  configureSupabaseMock();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("BloomGraph", () => {
  it("取得処理中は読み込み表示を出す", async () => {
    const sessionDeferred = createDeferred<SessionResult>();
    supabaseMocks.getSession.mockReturnValue(sessionDeferred.promise);

    render(<BloomGraph refreshKey={0} />);

    try {
      expect(screen.getByText(LOADING_MESSAGE)).toBeInTheDocument();
    } finally {
      await act(async () => {
        sessionDeferred.resolve(createSessionResult());
        await sessionDeferred.promise;
      });
    }

    await waitFor(() => {
      expect(screen.queryByText(LOADING_MESSAGE)).not.toBeInTheDocument();
    });
  });

  it("取得成功時に同じ日のお花を集計してグラフへ表示する", async () => {
    const bloomDate = createPastLocalNoonDate();
    const expectedDate = toLocalDateString(bloomDate);
    configureSupabaseMock({
      bloomLogsResult: createBloomLogsResult([
        { created_at: bloomDate.toISOString() },
        { created_at: bloomDate.toISOString() },
      ]),
    });

    render(<BloomGraph refreshKey={0} />);

    expect(
      await screen.findByTitle(`${expectedDate} : 2回咲いた`),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(supabaseMocks.from).toHaveBeenCalledWith("bloom_logs");
    expect(supabaseMocks.select).toHaveBeenCalledWith("created_at");
    expect(supabaseMocks.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(supabaseMocks.gte).toHaveBeenCalledWith(
      "created_at",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    );

    const startDateIso = supabaseMocks.gte.mock.calls[0][1];
    const startDate = new Date(startDateIso);
    expect(Number.isNaN(startDate.getTime())).toBe(false);
    expect(startDate.getDay()).toBe(0);
  });

  it("セッション取得エラー時に読込エラーを表示する", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    configureSupabaseMock({
      sessionResult: createSessionErrorResult({ message: "session failed" }),
    });

    render(<BloomGraph refreshKey={0} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      LOAD_ERROR_MESSAGE,
    );
    expect(supabaseMocks.from).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    expect(screen.queryByText(LOADING_MESSAGE)).not.toBeInTheDocument();
  });

  it("bloom_logs取得エラー時に読込エラーを表示する", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    configureSupabaseMock({
      bloomLogsResult: {
        data: null,
        error: { message: "bloom_logs failed" },
      },
    });

    render(<BloomGraph refreshKey={0} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      LOAD_ERROR_MESSAGE,
    );
    expect(consoleError).toHaveBeenCalled();
    expect(screen.queryByText("少")).not.toBeInTheDocument();
    expect(screen.queryByText("多")).not.toBeInTheDocument();
  });

  it("取得中に想定外の例外が発生しても読込エラーを表示する", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    configureSupabaseMock({
      getSessionException: new Error("session exploded"),
    });

    let renderError: unknown;
    try {
      render(<BloomGraph refreshKey={0} />);
    } catch (error) {
      renderError = error;
    }

    expect(renderError).toBeUndefined();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      LOAD_ERROR_MESSAGE,
    );
    expect(consoleError).toHaveBeenCalled();
    expect(screen.queryByText(LOADING_MESSAGE)).not.toBeInTheDocument();
  });

  it("refreshKeyが変化したときに成長記録を再取得する", async () => {
    const { rerender } = render(<BloomGraph refreshKey={0} />);

    await waitFor(() => {
      expect(supabaseMocks.getSession).toHaveBeenCalledTimes(1);
      expect(supabaseMocks.from).toHaveBeenCalledWith("bloom_logs");
      expect(supabaseMocks.gte).toHaveBeenCalledTimes(1);
    });

    rerender(<BloomGraph refreshKey={0} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(supabaseMocks.getSession).toHaveBeenCalledTimes(1);
    expect(supabaseMocks.from).toHaveBeenCalledTimes(1);
    expect(supabaseMocks.gte).toHaveBeenCalledTimes(1);

    rerender(<BloomGraph refreshKey={1} />);

    await waitFor(() => {
      expect(supabaseMocks.getSession).toHaveBeenCalledTimes(2);
      expect(supabaseMocks.from).toHaveBeenCalledTimes(2);
      expect(supabaseMocks.select).toHaveBeenCalledTimes(2);
      expect(supabaseMocks.eq).toHaveBeenCalledTimes(2);
      expect(supabaseMocks.gte).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
