import { createSupabaseServerClient } from "@/app/lib/supabaseServer";

const PAGE_SIZE = 1000;
const cacheControl = { "Cache-Control": "private, no-store" };

type ExportTable =
  | "favorite_affirmations"
  | "three_good_things"
  | "bloom_logs";

const exportQueries = {
  favorite_affirmations: "id,text,created_at",
  three_good_things: "id,date,things1,things2,things3,created_at",
  bloom_logs: "id,flower_type,created_at",
} satisfies Record<ExportTable, string>;

async function readAllRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: ExportTable,
  userId: string,
) {
  const rows: unknown[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select(exportQueries[table])
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error || !data) throw new Error("export query failed");
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

function errorResponse(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: cacheControl },
  );
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return errorResponse(
        "ログインが必要です。もう一度ログインしてください。",
        401,
      );
    }

    const userId = authData.user.id;
    const [favoriteAffirmations, threeGoodThings, bloomLogs] =
      await Promise.all([
        readAllRows(supabase, "favorite_affirmations", userId),
        readAllRows(supabase, "three_good_things", userId),
        readAllRows(supabase, "bloom_logs", userId),
      ]);
    const exportedAt = new Date().toISOString();
    const fileDate = exportedAt.slice(0, 10);

    return Response.json(
      {
        formatVersion: 1,
        exportedAt,
        account: { email: authData.user.email ?? "" },
        favoriteAffirmations,
        threeGoodThings,
        bloomLogs,
      },
      {
        headers: {
          ...cacheControl,
          "Content-Disposition": `attachment; filename="daily-affirmation-data-${fileDate}.json"`,
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    );
  } catch {
    return errorResponse(
      "データを書き出せませんでした。時間をおいてもう一度お試しください。",
      500,
    );
  }
}
