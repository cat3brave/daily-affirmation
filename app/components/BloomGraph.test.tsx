import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SupabaseError = { message: string };
type SessionResult = {
  data: { session: { user: { id: string } } | null };
  error: SupabaseError | null;
};
type BloomLog = { created_at: string };
type BloomLogsResult = { data: BloomLog[] | null; error: SupabaseError | null };
type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

const supabaseMocks = vi.hoisted(() => {
  const getSession = vi.fn<() => Promise<SessionResult>>();
  const gte = vi.fn<(column: string, value: string) => Promise<BloomLogsResult>>();
  const eq = vi.fn<(column: string, value: string) => { gte: typeof gte }>();
  const select = vi.fn<(columns: string) => { eq: typeof eq }>();
  const from = vi.fn<(table: string) => { select: typeof select }>();
  const createSupabaseBrowserClient = vi.fn(() => ({
    auth: { getSession },
    from,
  }));

  return { createSupabaseBrowserClient, eq, from, getSession, gte, select };
});

vi.mock("../lib/supabaseClient", () => ({
  createSupabaseBrowserClient: supabaseMocks.createSupabaseBrowserClient,
}));

import BloomGraph from "./BloomGraph";

const USER_ID = "user-bloom-1";
const NOW = new Date("2026-06-17T12:00:00.000Z");
const GRAPH_NAME = "お花の成長記録（過去3ヶ月）";
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

  if (!resolve || !reject) throw new Error("Deferred promise was not initialized.");
  return { promise, reject, resolve };
}

function createSessionResult(userId = USER_ID): SessionResult {
  return { data: { session: { user: { id: userId } } }, error: null };
}

function createSessionErrorResult(error: SupabaseError): SessionResult {
  return { data: { session: null }, error };
}

function createBloomLogsResult(data: BloomLog[] = []): BloomLogsResult {
  return { data, error: null };
}

function configureSupabaseMock({
  bloomLogsResult = createBloomLogsResult(),
  getSessionException,
  sessionResult = createSessionResult(),
}: {
  bloomLogsResult?: BloomLogsResult;
  getSessionException?: Error;
  sessionResult?: SessionResult;
} = {}) {
  supabaseMocks.getSession.mockReset();
  supabaseMocks.from.mockReset();
  supabaseMocks.select.mockReset();
  supabaseMocks.eq.mockReset();
  supabaseMocks.gte.mockReset();
  supabaseMocks.getSession.mockImplementation(async () => {
    if (getSessionException) throw getSessionException;
    return sessionResult;
  });
  supabaseMocks.from.mockReturnValue({ select: supabaseMocks.select });
  supabaseMocks.select.mockReturnValue({ eq: supabaseMocks.eq });
  supabaseMocks.eq.mockReturnValue({ gte: supabaseMocks.gte });
  supabaseMocks.gte.mockResolvedValue(bloomLogsResult);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  configureSupabaseMock();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("BloomGraph", () => {
  it("取得処理中は読み込み状況を通知する", async () => {
    const sessionDeferred = createDeferred<SessionResult>();
    supabaseMocks.getSession.mockReturnValue(sessionDeferred.promise);

    render(<BloomGraph refreshKey={0} />);

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(LOADING_MESSAGE);
    expect(status).toHaveAttribute("aria-live", "polite");

    await act(async () => sessionDeferred.resolve(createSessionResult()));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("名前付きの領域で期間、合計、日別の集計を自然な日付として伝える", async () => {
    configureSupabaseMock({
      bloomLogsResult: createBloomLogsResult([
        { created_at: "2026-06-15T01:00:00.000Z" },
        { created_at: "2026-06-15T10:00:00.000Z" },
        { created_at: "2026-06-16T12:00:00.000Z" },
      ]),
    });

    render(<BloomGraph refreshKey={0} />);

    const graph = await screen.findByRole("region", { name: GRAPH_NAME });
    expect(within(graph).getByRole("heading", { name: GRAPH_NAME })).toBeVisible();
    expect(graph).toHaveTextContent(
      /対象期間は2026年3月22日日曜日から2026年6月17日水曜日までです。\s*期間内の合計開花数は3回です。/,
    );
    expect(within(graph).getByText("2026年6月15日月曜日：2回")).toBeInTheDocument();
    expect(within(graph).getByText("2026年6月16日火曜日：1回")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    expect(supabaseMocks.from).toHaveBeenCalledWith("bloom_logs");
    expect(supabaseMocks.select).toHaveBeenCalledWith("created_at");
    expect(supabaseMocks.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(supabaseMocks.gte).toHaveBeenCalledWith(
      "created_at",
      "2026-03-22T12:00:00.000Z",
    );
  });

  it("記録がない期間を明確に伝える", async () => {
    render(<BloomGraph refreshKey={0} />);

    const graph = await screen.findByRole("region", { name: GRAPH_NAME });
    expect(graph).toHaveTextContent("期間内の合計開花数は0回です。");
    expect(graph).toHaveTextContent("期間内に開花記録はありません。");
  });

  it("未来の記録を集計せず、視覚用グリッドを読み上げとTab移動から除外する", async () => {
    configureSupabaseMock({
      bloomLogsResult: createBloomLogsResult([
        { created_at: "2026-06-16T12:00:00.000Z" },
        { created_at: "2026-06-18T12:00:00.000Z" },
      ]),
    });

    render(<BloomGraph refreshKey={0} />);

    const graph = await screen.findByRole("region", { name: GRAPH_NAME });
    expect(graph).toHaveTextContent("期間内の合計開花数は1回です。");
    expect(graph).not.toHaveTextContent("2026年6月18日木曜日");
    expect(within(graph).queryAllByRole("button")).toHaveLength(0);
    expect(within(graph).queryAllByRole("gridcell")).toHaveLength(0);
    expect(graph.querySelectorAll("[tabindex]")).toHaveLength(0);
    expect(
      screen.getByTitle("2026-06-16 : 1回咲いた").closest("[aria-hidden='true']"),
    ).toBeInTheDocument();
  });

  it("既存の取得エラーをalertとして表示する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    configureSupabaseMock({
      sessionResult: createSessionErrorResult({ message: "session failed" }),
    });

    render(<BloomGraph refreshKey={0} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(LOAD_ERROR_MESSAGE);
    expect(supabaseMocks.from).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("bloom_logs取得エラー時にも既存のalertを表示する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    configureSupabaseMock({
      bloomLogsResult: { data: null, error: { message: "bloom_logs failed" } },
    });

    render(<BloomGraph refreshKey={0} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(LOAD_ERROR_MESSAGE);
    expect(screen.queryByText("少")).not.toBeInTheDocument();
    expect(screen.queryByText("多")).not.toBeInTheDocument();
  });

  it("取得中の例外でも既存のalertを表示する", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    configureSupabaseMock({ getSessionException: new Error("session exploded") });

    render(<BloomGraph refreshKey={0} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(LOAD_ERROR_MESSAGE);
  });

  it("refreshKeyが変化したときに成長記録を再取得する", async () => {
    const { rerender } = render(<BloomGraph refreshKey={0} />);

    await waitFor(() => expect(supabaseMocks.gte).toHaveBeenCalledTimes(1));
    rerender(<BloomGraph refreshKey={0} />);
    await act(async () => Promise.resolve());
    expect(supabaseMocks.gte).toHaveBeenCalledTimes(1);

    rerender(<BloomGraph refreshKey={1} />);
    await waitFor(() => {
      expect(supabaseMocks.getSession).toHaveBeenCalledTimes(2);
      expect(supabaseMocks.from).toHaveBeenCalledTimes(2);
      expect(supabaseMocks.select).toHaveBeenCalledTimes(2);
      expect(supabaseMocks.eq).toHaveBeenCalledTimes(2);
      expect(supabaseMocks.gte).toHaveBeenCalledTimes(2);
    });
  });
});
