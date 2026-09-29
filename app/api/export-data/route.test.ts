import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/app/lib/supabaseServer", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import { GET } from "./route";

function createSupabaseMock(options?: {
  user?: { id: string; email: string } | null;
  authError?: object | null;
  rows?: Record<string, Row[]>;
  failedTable?: string;
}) {
  const ranges: Array<{ table: string; from: number; to: number }> = [];
  const filters: Array<{ table: string; column: string; value: string }> = [];
  const selects: Array<{ table: string; columns: string }> = [];
  const orders: Array<{ table: string; column: string }> = [];
  const from = vi.fn((table: string) => {
    const query = {
      select(columns: string) {
        selects.push({ table, columns });
        return query;
      },
      eq(column: string, value: string) {
        filters.push({ table, column, value });
        return query;
      },
      order(column: string) {
        orders.push({ table, column });
        return query;
      },
      async range(rangeFrom: number, to: number) {
        ranges.push({ table, from: rangeFrom, to });
        if (options?.failedTable === table) {
          return { data: null, error: { message: "secret SQL details" } };
        }
        return {
          data: (options?.rows?.[table] ?? []).slice(rangeFrom, to + 1),
          error: null,
        };
      },
    };
    return query;
  });
  const getUser = vi.fn().mockResolvedValue({
    data: { user: options?.user === undefined ? { id: "verified-user", email: "me@example.com" } : options.user },
    error: options?.authError ?? null,
  });
  return { client: { auth: { getUser }, from }, getUser, from, ranges, filters, selects, orders };
}

beforeEach(() => {
  vi.useRealTimers();
});

describe("GET /api/export-data", () => {
  it("未認証ではテーブルを読まず固定メッセージを返す", async () => {
    const supabase = createSupabaseMock({ user: null });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase.client);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ error: "ログインが必要です。もう一度ログインしてください。" });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("検証済みユーザーで3テーブルを明示カラム・安定順に取得してJSONにする", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T12:34:56.000Z"));
    const rows = {
      favorite_affirmations: [{ id: "f1", text: "大丈夫", created_at: "2026-01-01" }],
      three_good_things: [{ id: "g1", date: "2026-01-02", things1: "朝", things2: "昼", things3: "夜", created_at: "2026-01-02" }],
      bloom_logs: [{ id: "b1", flower_type: "tulip", created_at: "2026-01-03" }],
    };
    const supabase = createSupabaseMock({ rows });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase.client);

    const response = await GET();

    expect(supabase.getUser).toHaveBeenCalledOnce();
    expect(supabase.filters).toEqual([
      { table: "favorite_affirmations", column: "user_id", value: "verified-user" },
      { table: "three_good_things", column: "user_id", value: "verified-user" },
      { table: "bloom_logs", column: "user_id", value: "verified-user" },
    ]);
    expect(supabase.selects).toEqual([
      { table: "favorite_affirmations", columns: "id,text,created_at" },
      { table: "three_good_things", columns: "id,date,things1,things2,things3,created_at" },
      { table: "bloom_logs", columns: "id,flower_type,created_at" },
    ]);
    expect(supabase.orders).toEqual(expect.arrayContaining([
      { table: "favorite_affirmations", column: "created_at" },
      { table: "favorite_affirmations", column: "id" },
      { table: "three_good_things", column: "created_at" },
      { table: "three_good_things", column: "id" },
      { table: "bloom_logs", column: "created_at" },
      { table: "bloom_logs", column: "id" },
    ]));
    const body = await response.json();
    expect(body).toEqual({
      formatVersion: 1,
      exportedAt: "2026-09-27T12:34:56.000Z",
      account: { email: "me@example.com" },
      favoriteAffirmations: rows.favorite_affirmations,
      threeGoodThings: rows.three_good_things,
      bloomLogs: rows.bloom_logs,
    });
    expect(response.headers.get("Content-Disposition")).toContain("daily-affirmation-data-2026-09-27.json");
    expect(JSON.stringify(body)).not.toContain("user_id");
  });

  it("1000件を超えても全件をページ取得する", async () => {
    const favorites = Array.from({ length: 1001 }, (_, index) => ({ id: `f${index}`, text: `${index}`, created_at: index }));
    const supabase = createSupabaseMock({ rows: { favorite_affirmations: favorites } });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase.client);

    const response = await GET();
    const body = await response.json();

    expect(body.favoriteAffirmations).toHaveLength(1001);
    expect(supabase.ranges.filter(({ table }) => table === "favorite_affirmations")).toEqual([
      { table: "favorite_affirmations", from: 0, to: 999 },
      { table: "favorite_affirmations", from: 1000, to: 1999 },
    ]);
  });

  it("1テーブルでも失敗すると内部情報や部分データを返さない", async () => {
    const supabase = createSupabaseMock({
      rows: { favorite_affirmations: [{ id: "do-not-return" }] },
      failedTable: "bloom_logs",
    });
    mocks.createSupabaseServerClient.mockResolvedValue(supabase.client);

    const response = await GET();
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(text).toContain("データを書き出せませんでした。時間をおいてもう一度お試しください。");
    expect(text).not.toContain("secret SQL details");
    expect(text).not.toContain("do-not-return");
  });
});
