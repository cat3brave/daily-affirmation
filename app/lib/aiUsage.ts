import "server-only";
import type { createSupabaseServerClient } from "./supabaseServer";

export const AI_USAGE_TIMEOUT_MS = 5_000;
export type AiUsageReason = "minute_limit" | "daily_limit" | "daily_and_minute_limit";
export type AiUsageFailure =
  | { status: "usage_unavailable"; message: string }
  | { status: "usage_limited"; reason: AiUsageReason; retryAt: string; message: string };
const UNAVAILABLE: AiUsageFailure = {
  status: "usage_unavailable",
  message: "利用状況を確認できませんでした。時間をおいて再度お試しください。",
};

function validRetryAt(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second, offsetHour = "0", offsetMinute = "0"] = match;
  const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= days &&
    Number(hour) < 24 && Number(minute) < 60 && Number(second) < 60 &&
    Number(offsetHour) < 24 && Number(offsetMinute) < 60;
}

function validRow(data: unknown): data is [{
  allowed: boolean; reason: "allowed" | AiUsageReason;
  daily_remaining: number; minute_remaining: number; retry_at: string | null;
}] {
  if (!Array.isArray(data) || data.length !== 1) return false;
  const row = data[0];
  if (typeof row !== "object" || row === null) return false;
  const { allowed, reason, daily_remaining: daily, minute_remaining: minute, retry_at: retry } = row;
  if (typeof allowed !== "boolean" || !Number.isInteger(daily) || daily < 0 || daily > 20 ||
      !Number.isInteger(minute) || minute < 0 || minute > 3) return false;
  // 許可時の残量は、今回確保した1回を差し引いた値。
  if (allowed) return reason === "allowed" && daily <= 19 && minute <= 2 && retry === null;
  if (!validRetryAt(retry)) return false;
  return (reason === "minute_limit" && daily > 0 && minute === 0) ||
    (reason === "daily_limit" && daily === 0 && minute > 0) ||
    (reason === "daily_and_minute_limit" && daily === 0 && minute === 0);
}

// nullだけが許可。結果不明時にも再試行・返却をせず、必ず閉じる。
export async function reserveAiUsage(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<AiUsageFailure | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error("AI usage request timed out"));
    }, AI_USAGE_TIMEOUT_MS);
  });
  try {
    // SDKのPOST RPCを一度だけ実行。SDK側のretryも明示的に無効にする。
    const request = supabase.rpc("reserve_ai_usage").abortSignal(controller.signal).retry(false);
    const { data, error } = await Promise.race([request, deadline]);
    if (timedOut || error || !validRow(data)) return UNAVAILABLE;
    const row = data[0];
    if (row.allowed) return null;
    const reason = row.reason as AiUsageReason;
    const retryAt = row.retry_at!;
    const guidance = {
      minute_limit: "短時間の利用上限に達しました。少し待ってから再度お試しください。",
      daily_limit: "本日の利用上限に達しました。",
      daily_and_minute_limit: "本日の利用上限と短時間の利用上限に達しました。",
    }[reason];
    const time = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).format(new Date(retryAt));
    return { status: "usage_limited", reason, retryAt,
      message: `${guidance} 再利用の目安：${time}（日本時間）。その後の利用状況によっては再び制限される場合があります。` };
  } catch {
    return UNAVAILABLE;
  } finally {
    clearTimeout(timer);
  }
}
