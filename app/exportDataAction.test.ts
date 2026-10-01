import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn(), createSupabaseServerClient: vi.fn() }));
vi.mock("./lib/supabaseServer", () => mocks);
import { exportUserData } from "./exportDataAction";

const tables = {
  todos: { key: "todos", columns: "id,text,completed,created_at" },
  favorite_affirmations: { key: "favoriteAffirmations", columns: "id,text,created_at" },
  three_good_things: { key: "threeGoodThings", columns: "id,date,things1,things2,things3,created_at" },
  bloom_logs: { key: "bloomLogs", columns: "id,flower_type,created_at" },
} as const;
type Table = keyof typeof tables;
type Row = Record<string, unknown>;
type QueryCall = {
  table: string;
  columns: string;
  filters: { column: string; value: string }[];
  orders: { column: string; ascending: boolean }[];
  start: number;
  end: number;
};

// フィルター→複合ソート→range→列選択を実際に適用し、履歴だけのモックにしない。
function createClient(rows: Partial<Record<Table, Row[]>> = {}, failure?: { table: Table; start: number; mode: "error" | "throw" | "null" }) {
  const calls: QueryCall[] = [];
  const from = vi.fn((table: Table) => {
    let columns = "";
    const filters: QueryCall["filters"] = [];
    const orders: QueryCall["orders"] = [];
    const query = {
      select(value: string) { columns = value; return query; },
      eq(column: string, value: string) { filters.push({ column, value }); return query; },
      order(column: string, options: { ascending: boolean }) { orders.push({ column, ascending: options.ascending }); return query; },
      async range(start: number, end: number) {
        calls.push({ table, columns, filters, orders, start, end });
        if (table === failure?.table && start === failure.start) {
          if (failure.mode === "throw") throw new Error("secret database error");
          return { data: null, error: failure.mode === "error" ? { message: "secret database error" } : null };
        }
        const matching = (rows[table] ?? []).filter((row) => filters.every(({ column, value }) => row[column] === value));
        matching.sort((a, b) => {
          for (const { column, ascending } of orders) {
            const left = String(a[column]);
            const right = String(b[column]);
            if (left !== right) return (left < right ? -1 : 1) * (ascending ? 1 : -1);
          }
          return 0;
        });
        const selected = matching.slice(start, end + 1).map((row) =>
          Object.fromEntries(columns.split(",").map((column) => [column, row[column]])),
        );
        return { data: selected, error: null };
      },
    };
    return query;
  });
  return { client: { from }, from, calls };
}

function makeRows(table: Table, count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${table}-${String(index).padStart(5, "0")}`,
    user_id: "verified-user",
    // 同じ作成時刻の行も含め、idによるタイブレークを検証する。
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, Math.floor(index / 3))).toISOString(),
    text: `text-${index}`, completed: index % 2 === 0,
    date: "2026-01-01", things1: `good-${index}`, things2: null, things3: null,
    flower_type: "tulip", internal_secret: "do not leak",
  }));
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("exportUserData", () => {
  it.each([null, "throws"])("認証できない場合(%s)はクエリしない", async (mode) => {
    const client = createClient();
    mocks.getAuthenticatedUser.mockImplementation(() => mode === "throws" ? Promise.reject(new Error("token secret")) : Promise.resolve(null));
    mocks.createSupabaseServerClient.mockResolvedValue(client.client);
    expect(await exportUserData()).toEqual(mode === "throws" ? { status: "error" } : { status: "auth_required" });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it.each([0, 999, 1000, 1001, 2000, 2501])("全4テーブルの%s件を欠落・重複なく取得し、各ページの制約を維持する", async (count) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T15:30:00.000Z"));
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "verified-user", email: "private@example.com" });
    const rows: Partial<Record<Table, Row[]>> = {};
    const expected: Record<string, Row[]> = {};
    for (const table of Object.keys(tables) as Table[]) {
      const ownRows = makeRows(table, count);
      expected[tables[table].key] = ownRows.map((row) => Object.fromEntries(tables[table].columns.split(",").map((column) => [column, row[column]])));
      // 他ユーザーの行と内部列を混ぜ、クエリの制約が結果に反映されることを検証する。
      rows[table] = [...ownRows, { ...makeRows(table, 1)[0], id: "other-user", user_id: "other-user", text: "他ユーザーの秘密" }].reverse();
    }
    const client = createClient(rows);
    mocks.createSupabaseServerClient.mockResolvedValue(client.client);
    const result = await exportUserData();
    expect(result).toEqual({ status: "success", data: { schemaVersion: 1, exportedAt: "2026-09-27T15:30:00.000Z", ...expected } });
    for (const table of Object.keys(tables) as Table[]) {
      const pages = Math.floor(count / 1000) + 1;
      expect(client.calls.filter((call) => call.table === table)).toEqual(
        Array.from({ length: pages }, (_, page) => ({
          table, columns: tables[table].columns,
          filters: [{ column: "user_id", value: "verified-user" }],
          orders: [{ column: "created_at", ascending: true }, { column: "id", ascending: true }],
          start: page * 1000, end: page * 1000 + 999,
        })),
      );
      if (result.status === "success") {
        const exported = result.data[tables[table].key] as Row[];
        expect(exported).toHaveLength(count);
        expect(new Set(exported.map((row) => row.id)).size).toBe(count);
      }
    }
    expect(JSON.stringify(result)).not.toMatch(/private@example|user_id|other-user|他ユーザーの秘密|internal_secret|do not leak|token|cookie|api.?key/i);
  });

  for (const table of Object.keys(tables) as Table[]) {
    it.each([
      [0, "error"], [1000, "error"], [2000, "error"],
      [1000, "throw"], [1000, "null"],
    ] as const)(`${table}のrange開始%sで%sの場合、部分データや内部エラーを返さない`, async (start, mode) => {
      mocks.getAuthenticatedUser.mockResolvedValue({ id: "verified-user" });
      const client = createClient({ [table]: makeRows(table, 2501) }, { table, start, mode });
      mocks.createSupabaseServerClient.mockResolvedValue(client.client);
      const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const warnLog = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
      expect(await exportUserData()).toEqual({ status: "error" });
      expect(client.calls.filter((call) => call.table === table).map((call) => call.start)).toEqual(
        Array.from({ length: start / 1000 + 1 }, (_, page) => page * 1000),
      );
      expect(errorLog).not.toHaveBeenCalled();
      expect(warnLog).not.toHaveBeenCalled();
      expect(log).not.toHaveBeenCalled();
    });
  }
});
