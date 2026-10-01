import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  createSupabaseServerClient: vi.fn(),
}));
vi.mock("./lib/supabaseServer", () => mocks);
import { exportUserData } from "./exportDataAction";

type Row = { id: string; user_id: string; created_at: string; [key: string]: unknown };
type QueryCall = {
  table: string;
  columns: string;
  filters: Array<{ column: string; value: string }>;
  orders: Array<{ column: string; options: { ascending: boolean } }>;
  range: [number, number];
};

const exportColumns = {
  todos: "id,text,completed,created_at",
  favorite_affirmations: "id,text,created_at",
  three_good_things: "id,date,things1,things2,things3,created_at",
  bloom_logs: "id,flower_type,created_at",
} as const;
type Table = keyof typeof exportColumns;
const tables = Object.keys(exportColumns) as Table[];

function createRows(count: number, userId = "verified-user"): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `id-${String(index).padStart(4, "0")}`,
    user_id: userId,
    created_at: `2026-01-01T00:${String(Math.floor(index / 60) % 60).padStart(2, "0")}:${String(index % 60).padStart(2, "0")}.000Z`,
    text: `row-${index}`,
  }));
}

function createClient(
  rows: Partial<Record<Table, Row[]>> = {},
  failAt?: { table: Table; start: number },
) {
  const calls: QueryCall[] = [];
  const from = vi.fn((table: Table) => {
    const call: Omit<QueryCall, "range"> & { range?: [number, number] } = {
      table,
      columns: "",
      filters: [],
      orders: [],
    };
    const query = {
      select(columns: string) {
        call.columns = columns;
        return query;
      },
      eq(column: string, value: string) {
        call.filters.push({ column, value });
        return query;
      },
      order(column: string, options: { ascending: boolean }) {
        call.orders.push({ column, options });
        return query;
      },
      async range(start: number, end: number) {
        call.range = [start, end];
        calls.push(call as QueryCall);
        if (failAt?.table === table && failAt.start === start) {
          return { data: null, error: { message: "secret database error" } };
        }

        const selectedColumns = call.columns.split(",");
        const filtered = (rows[table] ?? [])
          .filter((row) => call.filters.every(({ column, value }) => row[column] === value))
          .sort((left, right) => {
            for (const { column, options } of call.orders) {
              const comparison = String(left[column]).localeCompare(String(right[column]));
              if (comparison) return options.ascending ? comparison : -comparison;
            }
            return 0;
          })
          .slice(start, end + 1)
          .map((row) => Object.fromEntries(selectedColumns.map((column) => [column, row[column]])));
        return { data: filtered, error: null };
      },
    };
    return query;
  });
  return { client: { from }, from, calls };
}

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("exportUserData", () => {
  it.each([null, "throws"])("認証できない場合(%s)はクエリしない", async (mode) => {
    const client = createClient();
    mocks.getAuthenticatedUser.mockImplementation(() =>
      mode === "throws" ? Promise.reject(new Error("token secret")) : Promise.resolve(null),
    );
    mocks.createSupabaseServerClient.mockResolvedValue(client.client);
    expect(await exportUserData()).toEqual(
      mode === "throws" ? { status: "error" } : { status: "auth_required" },
    );
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it.each([0, 999, 1000, 1001, 2001])(
    "%i件を欠落・重複なく正しいページ範囲で返す",
    async (count) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-09-27T12:34:56.000Z"));
      mocks.getAuthenticatedUser.mockResolvedValue({
        id: "verified-user",
        email: "private@example.com",
      });
      const sourceRows = createRows(count);
      const client = createClient(Object.fromEntries(tables.map((table) => [table, sourceRows])));
      mocks.createSupabaseServerClient.mockResolvedValue(client.client);

      const result = await exportUserData();
      expect(result.status).toBe("success");
      if (result.status !== "success") throw new Error("expected successful export");

      for (const resultRows of [
        result.data.todos,
        result.data.favoriteAffirmations,
        result.data.threeGoodThings,
        result.data.bloomLogs,
      ]) {
        expect(resultRows).toHaveLength(count);
        expect(new Set(resultRows.map((row) => (row as { id: string }).id)).size).toBe(count);
      }
      const expectedRanges = Array.from(
        { length: Math.floor(count / 1000) + 1 },
        (_, page) => [page * 1000, page * 1000 + 999],
      );
      for (const table of tables) {
        const calls = client.calls.filter((call) => call.table === table);
        expect(calls.map((call) => call.range)).toEqual(expectedRanges);
        expect(calls.every((call) => call.columns === exportColumns[table])).toBe(true);
        expect(calls.every((call) =>
          JSON.stringify(call.filters) === JSON.stringify([{ column: "user_id", value: "verified-user" }]),
        )).toBe(true);
        expect(calls.every((call) =>
          JSON.stringify(call.orders) === JSON.stringify([
            { column: "created_at", options: { ascending: true } },
            { column: "id", options: { ascending: true } },
          ]),
        )).toBe(true);
      }
      expect(result.data.exportedAt).toBe("2026-09-27T12:34:56.000Z");
      expect(JSON.stringify(result)).not.toMatch(/private@example|user_id|token|cookie|api.?key/i);
    },
  );

  it("2ページ目以降の取得失敗では部分データや生エラーを返さない", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "verified-user", email: "" });
    const client = createClient(
      Object.fromEntries(tables.map((table) => [table, createRows(1001)])),
      { table: "bloom_logs", start: 1000 },
    );
    mocks.createSupabaseServerClient.mockResolvedValue(client.client);

    const result = await exportUserData();

    expect(result).toEqual({ status: "error" });
    expect(client.calls).toContainEqual(expect.objectContaining({
      table: "bloom_logs",
      range: [1000, 1999],
    }));
    expect(JSON.stringify(result)).not.toMatch(/secret|row-/i);
  });
});
