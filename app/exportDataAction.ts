"use server";

import {
  createSupabaseServerClient,
  getAuthenticatedUser,
} from "./lib/supabaseServer";

const PAGE_SIZE = 1000;

type ExportTable =
  | "todos"
  | "favorite_affirmations"
  | "three_good_things"
  | "bloom_logs";

const exportColumns = {
  todos: "id,text,completed,created_at",
  favorite_affirmations: "id,text,created_at",
  three_good_things: "id,date,things1,things2,things3,created_at",
  bloom_logs: "id,flower_type,created_at",
} satisfies Record<ExportTable, string>;

export type UserDataExport = {
  schemaVersion: 1;
  exportedAt: string;
  todos: unknown[];
  favoriteAffirmations: unknown[];
  threeGoodThings: unknown[];
  bloomLogs: unknown[];
};

export type ExportDataResult =
  | { status: "success"; data: UserDataExport }
  | { status: "auth_required" }
  | { status: "error" };

async function readAllRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: ExportTable,
  userId: string,
) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(exportColumns[table])
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data) throw new Error("export failed");
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

export async function exportUserData(): Promise<ExportDataResult> {
  try {
    // クライアント入力ではなく、Authサーバーで検証したIDだけを使用する。
    const user = await getAuthenticatedUser();
    if (!user) return { status: "auth_required" };

    const supabase = await createSupabaseServerClient();
    const [todos, favoriteAffirmations, threeGoodThings, bloomLogs] =
      await Promise.all([
        readAllRows(supabase, "todos", user.id),
        readAllRows(supabase, "favorite_affirmations", user.id),
        readAllRows(supabase, "three_good_things", user.id),
        readAllRows(supabase, "bloom_logs", user.id),
      ]);

    return {
      status: "success",
      data: {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        todos,
        favoriteAffirmations,
        threeGoodThings,
        bloomLogs,
      },
    };
  } catch {
    return { status: "error" };
  }
}
