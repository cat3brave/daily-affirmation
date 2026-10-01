import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAuthenticatedUser: vi.fn(), createSupabaseServerClient: vi.fn() }));
vi.mock("./lib/supabaseServer", () => mocks);
import { exportUserData } from "./exportDataAction";

function createClient(rows: Record<string, Record<string, unknown>[]> = {}, failedTable = "") {
  const filters: { table: string; column: string; value: string }[] = [];
  const selects: { table: string; columns: string }[] = [];
  const from = vi.fn((table: string) => {
    const query = {
      select(columns: string) { selects.push({ table, columns }); return query; },
      eq(column: string, value: string) { filters.push({ table, column, value }); return query; },
      order() { return query; },
      async range(start: number, end: number) {
        if (table === failedTable) return { data: null, error: { message: "secret database error" } };
        return { data: (rows[table] ?? []).slice(start, end + 1), error: null };
      },
    };
    return query;
  });
  return { client: { from }, from, filters, selects };
}

beforeEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe("exportUserData", () => {
  it.each([null, "throws"])("認証できない場合(%s)はクエリしない", async (mode) => {
    const client = createClient();
    mocks.getAuthenticatedUser.mockImplementation(() => mode === "throws" ? Promise.reject(new Error("token secret")) : Promise.resolve(null));
    mocks.createSupabaseServerClient.mockResolvedValue(client.client);
    expect(await exportUserData()).toEqual(mode === "throws" ? { status: "error" } : { status: "auth_required" });
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it("全所有テーブルを検証済みIDで限定し、明示カラムと決定的な構造だけを返す", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-27T12:34:56.000Z"));
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "verified-user", email: "private@example.com" });
    const rows = {
      todos: [{ id: "t1", text: "todo", completed: false, created_at: "1" }],
      favorite_affirmations: [{ id: "f1", text: "大丈夫", created_at: "2" }],
      three_good_things: [{ id: "g1", date: "2026-01-01", things1: "朝", things2: null, things3: null, created_at: "3" }],
      bloom_logs: [{ id: "b1", flower_type: "tulip", created_at: "4" }],
    };
    const client = createClient(rows); mocks.createSupabaseServerClient.mockResolvedValue(client.client);
    const result = await exportUserData();
    expect(client.filters).toEqual(["todos", "favorite_affirmations", "three_good_things", "bloom_logs"].map((table) => ({ table, column: "user_id", value: "verified-user" })));
    expect(client.selects).toEqual([
      { table: "todos", columns: "id,text,completed,created_at" },
      { table: "favorite_affirmations", columns: "id,text,created_at" },
      { table: "three_good_things", columns: "id,date,things1,things2,things3,created_at" },
      { table: "bloom_logs", columns: "id,flower_type,created_at" },
    ]);
    expect(result).toEqual({ status: "success", data: { schemaVersion: 1, exportedAt: "2026-09-27T12:34:56.000Z", todos: rows.todos, favoriteAffirmations: rows.favorite_affirmations, threeGoodThings: rows.three_good_things, bloomLogs: rows.bloom_logs } });
    expect(JSON.stringify(result)).not.toMatch(/private@example|user_id|token|cookie|api.?key/i);
  });

  it("取得失敗では部分データや生エラーを返さない", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "verified-user", email: "" });
    mocks.createSupabaseServerClient.mockResolvedValue(createClient({ todos: [{ text: "do not leak" }] }, "bloom_logs").client);
    const result = await exportUserData();
    expect(result).toEqual({ status: "error" });
    expect(JSON.stringify(result)).not.toMatch(/secret|do not leak/i);
  });
});
