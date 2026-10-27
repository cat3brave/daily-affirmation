import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GoodThingsMonthlyHistory, { shiftMonth } from "./GoodThingsMonthlyHistory";
import ThreeGoodThingsCard from "./ThreeGoodThingsCard";

type Row = { user_id?: string; date: string; things1: string; things2?: string; things3?: string };
type Result = { data: Row[] | null; error: { message: string } | null };
const mock = vi.hoisted(() => ({
  getUser: vi.fn(), from: vi.fn(), unsubscribe: vi.fn(),
  listeners: [] as Array<(event: string, session: { user: { id: string } } | null) => void>,
  rows: [] as Row[], queries: [] as Array<{ columns: string; filters: string[][]; order?: unknown }>,
  pending: [] as Array<Promise<Result>>, mutation: vi.fn(),
}));
vi.mock("../lib/supabaseClient", () => ({ createSupabaseBrowserClient: () => client }));
const client = {
  auth: { getUser: mock.getUser, onAuthStateChange: (fn: typeof mock.listeners[number]) => {
    mock.listeners.push(fn); return { data: { subscription: { unsubscribe: mock.unsubscribe } } };
  } }, from: mock.from,
};
function deferred() {
  let resolve!: (result: Result) => void;
  const promise = new Promise<Result>((done) => { resolve = done; });
  return { promise, resolve };
}
const props = { userId: "owner", today: "2026-10-25", busy: false, revision: 0 };
function open() { fireEvent.click(screen.getByRole("button", { name: "過去の記録を見る" })); }
function click(name: string) { fireEvent.click(screen.getByRole("button", { name })); }
async function empty() { await screen.findByText("この月の記録はありません"); }
beforeEach(() => {
  mock.rows = []; mock.queries = []; mock.pending = []; mock.listeners = [];
  mock.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  mock.mutation.mockResolvedValue({ error: null });
  mock.from.mockImplementation(() => ({
    upsert: mock.mutation,
    delete: () => ({ eq: () => ({ eq: mock.mutation }) }),
    select: (columns: string) => {
      const query = { columns, filters: [] as string[][], order: undefined as unknown };
      const builder = {
        eq: (column: string, value: string) => { query.filters.push(["eq", column, value]); return builder; },
        gte: (column: string, value: string) => { query.filters.push(["gte", column, value]); return builder; },
        lt: (column: string, value: string) => { query.filters.push(["lt", column, value]); return builder; },
        lte: (column: string, value: string) => { query.filters.push(["lte", column, value]); return builder; },
        order: (column: string, options: unknown) => { query.order = [column, options]; return builder; },
        then: (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) => {
          if (columns !== "*") mock.queries.push(query);
          const pending = columns === "*" ? undefined : mock.pending.shift();
          const rows = mock.rows.filter((row) => query.filters.every(([op, col, value]) => {
            const actual = String(row[col as keyof Row] ?? "owner");
            return op === "eq" ? actual === value : op === "gte" ? actual >= value : op === "lt" ? actual < value : actual <= value;
          })).sort((a, b) => b.date.localeCompare(a.date));
          return (pending ?? Promise.resolve({ data: rows, error: null })).then(resolve, reject);
        },
      };
      return builder;
    },
  }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); localStorage.clear(); });

describe("monthly history", () => {
  it("loads lazily with owner, bounds, columns and descending date; reads older records and excludes future dates", async () => {
    mock.rows = [
      { date: "2026-10-01", things1: "14日より前", things2: "二つ目", things3: "三つ目" },
      { date: "2026-10-20", things1: "新しい記録" },
      { user_id: "other", date: "2026-10-21", things1: "別ユーザー" },
      { date: "2026-10-26", things1: "未来" }, { date: "2026-09-30", things1: "先月" },
    ];
    render(<GoodThingsMonthlyHistory {...props} />);
    expect(mock.from).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "過去の記録を見る" })).toHaveAttribute("aria-expanded", "false");
    open();
    await screen.findByText("14日より前");
    expect(mock.queries).toEqual([{ columns: "date,things1,things2,things3", filters: [
      ["eq", "user_id", "owner"], ["gte", "date", "2026-10-01"], ["lt", "date", "2026-11-01"], ["lte", "date", "2026-10-25"],
    ], order: ["date", { ascending: false }] }]);
    expect(screen.getAllByRole("time").map((node) => node.textContent)).toEqual(["2026-10-20", "2026-10-01"]);
    expect(screen.getByText("三つ目")).toBeVisible();
    for (const text of ["別ユーザー", "未来", "先月"]) expect(screen.queryByText(text)).toBeNull();
    expect(screen.getByRole("button", { name: "次の月" })).toBeDisabled();
  });

  it("moves across years, February and leap years, returns to this month and never goes forward", async () => {
    render(<GoodThingsMonthlyHistory {...props} today="2024-03-31" />); open(); await empty();
    click("前の月"); await empty();
    expect(screen.getByRole("heading", { name: "2024年2月" })).toBeVisible();
    expect(mock.queries.at(-1)?.filters).toContainEqual(["lt", "date", "2024-03-01"]);
    click("前の月"); await empty(); click("前の月"); await empty();
    expect(screen.getByRole("heading", { name: "2023年12月" })).toBeVisible();
    click("次の月"); await empty(); expect(screen.getByRole("heading", { name: "2024年1月" })).toBeVisible();
    click("今月へ"); await empty();
    expect(screen.getByRole("heading", { name: "2024年3月" })).toBeVisible();
    expect(screen.getByRole("button", { name: "次の月" })).toBeDisabled();
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2025-02", 1)).toBe("2025-03");
  });

  it("shows leap day without UTC parsing", async () => {
    mock.rows = [{ date: "2024-02-29", things1: "うるう日" }, { date: "2024-03-01", things1: "翌月" }];
    render(<GoodThingsMonthlyHistory {...props} today="2024-03-01" />); open(); await screen.findByText("翌月");
    click("前の月"); await screen.findByText("うるう日");
    expect(screen.getByText("2024-02-29")).toBeVisible(); expect(screen.queryByText("翌月")).toBeNull();
  });

  it("distinguishes loading, error and empty, retries once despite repeated clicks", async () => {
    const request = deferred(); mock.pending.push(request.promise);
    render(<GoodThingsMonthlyHistory {...props} />); open();
    expect(screen.getByRole("status")).toHaveTextContent("読み込んでいます");
    await waitFor(() => expect(mock.queries).toHaveLength(1));
    await act(async () => request.resolve({ data: null, error: { message: "failure" } }));
    const retry = await screen.findByRole("button", { name: "過去の記録を再読み込み" });
    expect(screen.getByRole("alert")).toBeVisible();
    act(() => { fireEvent.click(retry); fireEvent.click(retry); });
    await empty(); expect(mock.queries).toHaveLength(2);
  });

  it("discards delayed responses from another month and does not refetch the same in-flight month", async () => {
    const old = deferred(); mock.pending.push(old.promise);
    render(<GoodThingsMonthlyHistory {...props} />); open();
    await waitFor(() => expect(mock.queries).toHaveLength(1));
    click("今月へ"); expect(mock.queries).toHaveLength(1);
    click("前の月"); await empty();
    await act(async () => old.resolve({ data: [{ date: "2026-10-01", things1: "遅い応答" }], error: null }));
    expect(screen.queryByText("遅い応答")).toBeNull();
    expect(screen.getByRole("heading", { name: "2026年9月" })).toBeVisible();
  });

  it.each([null, "other"])("invalidates an old auth response after account becomes %s", async (id) => {
    const old = deferred(); mock.pending.push(old.promise);
    render(<GoodThingsMonthlyHistory {...props} />); open();
    await waitFor(() => expect(mock.queries).toHaveLength(1));
    act(() => mock.listeners.forEach((listener) => listener("SIGNED_OUT", id ? { user: { id } } : null)));
    await act(async () => old.resolve({ data: [{ date: "2026-10-01", things1: "前ユーザー" }], error: null }));
    expect(screen.queryByText("前ユーザー")).toBeNull();
  });

  it("discards responses after unmount and changes owner without showing previous records", async () => {
    const old = deferred(); mock.pending.push(old.promise);
    const view = render(<GoodThingsMonthlyHistory {...props} />); open();
    await waitFor(() => expect(mock.queries).toHaveLength(1)); view.unmount();
    mock.getUser.mockResolvedValue({ data: { user: { id: "other" } }, error: null });
    render(<GoodThingsMonthlyHistory {...props} userId="other" />); open(); await empty();
    await act(async () => old.resolve({ data: [{ date: "2026-10-01", things1: "前ユーザー" }], error: null }));
    expect(screen.queryByText("前ユーザー")).toBeNull();
    expect(mock.queries.at(-1)?.filters).toContainEqual(["eq", "user_id", "other"]);
  });

  it("invalidates pre-mutation loads and reloads after a successful mutation", async () => {
    const old = deferred(); mock.pending.push(old.promise);
    const view = render(<GoodThingsMonthlyHistory {...props} />); open();
    await waitFor(() => expect(mock.queries).toHaveLength(1));
    view.rerender(<GoodThingsMonthlyHistory {...props} busy />);
    expect(screen.getByRole("button", { name: "前の月" })).toBeDisabled();
    mock.rows = [{ date: "2026-10-25", things1: "保存成功" }];
    view.rerender(<GoodThingsMonthlyHistory {...props} revision={1} />);
    await screen.findByText("保存成功");
    await act(async () => old.resolve({ data: [], error: null }));
    expect(screen.getByText("保存成功")).toBeVisible();
    mock.rows = []; view.rerender(<GoodThingsMonthlyHistory {...props} busy revision={1} />);
    view.rerender(<GoodThingsMonthlyHistory {...props} revision={2} />); await empty();
  });

  it("keeps editor date, text and local draft during browsing, synchronizes successful save/delete only", async () => {
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    mock.rows = [{ date: "2026-09-01", things1: "過去の文章" }];
    render(<ThreeGoodThingsCard />);
    const input = await screen.findByRole("textbox", { name: "1つ目のよかったこと" });
    await waitFor(() => expect(input).toBeEnabled());
    fireEvent.change(input, { target: { value: "入力中" } });
    const draft = localStorage.getItem("daily-affirmation:three-good-things-draft:owner");
    open(); await empty(); click("前の月"); await screen.findByText("過去の文章");
    expect(input).toHaveValue("入力中"); expect(screen.getByText("入力対象日：2026-10-25")).toBeVisible();
    expect(localStorage.getItem("daily-affirmation:three-good-things-draft:owner")).toBe(draft);
    click("今月へ"); await empty();
    mock.mutation.mockImplementation(async () => {
      mock.rows.push({ date: "2026-10-25", things1: "入力中" }); return { error: null };
    });
    click("記録する");
    const history = screen.getByRole("region", { name: "月別の過去の記録" });
    await within(history).findByText("入力中");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mock.mutation.mockResolvedValueOnce({ error: { message: "delete failed" } });
    click("2026-10-25 の記録を削除");
    await screen.findByText("記録を削除できませんでした。もう一度お試しください。");
    expect(within(history).getByText("入力中")).toBeVisible();
    mock.mutation.mockImplementation(async () => { mock.rows = []; return { error: null }; });
    click("2026-10-25 の記録を削除"); await empty(); expect(input).toHaveValue("");
  });
});
