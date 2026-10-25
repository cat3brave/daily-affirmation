"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDashboardOperation, verifyDashboardOwner } from "../hooks/dashboardAuth";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";

// Calendar arithmetic only: never parse a date-only value as a UTC timestamp.
export function shiftMonth(month: string, delta: number) {
  const [year, number] = month.split("-").map(Number);
  const index = year * 12 + number - 1 + delta;
  return `${Math.floor(index / 12)}-${String((index % 12 + 12) % 12 + 1).padStart(2, "0")}`;
}
export function monthLabel(month: string) {
  const [year, number] = month.split("-").map(Number);
  return `${year}年${number}月`;
}
type Row = { date: string; things1: string | null; things2: string | null; things3: string | null };
type Props = { userId: string; today: string; busy: boolean; revision: number };
const buttonClass = "rounded-full border border-pink-200 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 disabled:opacity-50 disabled:cursor-not-allowed";

export default function GoodThingsMonthlyHistory(props: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <section className="mt-4 w-full min-w-0 text-pink-700" aria-label="月別の過去の記録">
    <button type="button" className={buttonClass} aria-expanded={open} aria-controls={id}
      disabled={props.busy} onClick={() => setOpen((value) => !value)}>
      {open ? "過去の記録を閉じる" : "過去の記録を見る"}
    </button>
    <div id={id}>{open && <MonthlyRecords {...props} />}</div>
  </section>;
}

function MonthlyRecords({ userId, today, busy, revision }: Props) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const { auth, capture } = useDashboardOperation(userId);
  const currentMonth = today.slice(0, 7);
  const [selectedMonth, setMonth] = useState(currentMonth);
  const month = selectedMonth > currentMonth ? currentMonth : selectedMonth;
  const [result, setResult] = useState<{ key: string; rows?: Row[]; error?: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const ownerValid = useRef(true);
  const key = `${userId}/${month}/${today}/${revision}/${retry}`;
  // Invalidate before passive effects, including the response from before a write.
  useLayoutEffect(() => {
    generation.current += 1;
    inFlight.current = false;
    return () => { generation.current += 1; inFlight.current = false; };
  }, [key, busy]);

  useEffect(() => {
    ownerValid.current = true;
    const listener = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id !== userId) {
        ownerValid.current = false;
        generation.current += 1;
        setResult(null);
      }
    });
    return () => listener.data.subscription.unsubscribe();
  }, [supabase, userId]);

  const load = useCallback(() => {
    if (busy || inFlight.current || !ownerValid.current) return;
    const valid = capture();
    const request = generation.current;
    const current = () => valid() && ownerValid.current && generation.current === request;
    inFlight.current = true;
    return verifyDashboardOwner(auth, supabase, userId, current).then(async (verified) => {
      if (!verified) return;
      const { data, error } = await supabase.from("three_good_things")
        .select("date,things1,things2,things3")
        .eq("user_id", userId)
        .gte("date", `${month}-01`)
        .lt("date", `${shiftMonth(month, 1)}-01`)
        .lte("date", today)
        .order("date", { ascending: false });
      if (!current()) return;
      if (error) throw error;
      setResult({ key, rows: (data ?? []).filter((row) => row.date <= today) });
    }).catch(() => {
      if (current()) setResult({ key, error: true });
    }).finally(() => {
      if (current()) inFlight.current = false;
    });
  }, [auth, busy, capture, key, month, supabase, today, userId]);
  useEffect(() => { void load(); }, [load]);
  const visible = result?.key === key ? result : null;
  const move = (next: string) => {
    if (busy || next > currentMonth || next === month) return;
    generation.current += 1;
    setMonth(next);
  };
  return <div className="mt-3 w-full min-w-0 rounded-xl bg-pink-50/30 p-3">
    <h4 className="mb-2 text-sm font-bold" aria-live="polite">{monthLabel(month)}</h4>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={buttonClass} disabled={busy} onClick={() => move(shiftMonth(month, -1))}>前の月</button>
      <button type="button" className={buttonClass} disabled={busy || month >= currentMonth} onClick={() => move(shiftMonth(month, 1))}>次の月</button>
      <button type="button" className={buttonClass} disabled={busy || month === currentMonth} onClick={() => move(currentMonth)}>今月へ</button>
    </div>
    {busy || !visible ? <p role="status" className="mt-3 text-xs">過去の記録を読み込んでいます...</p>
      : visible.error ? <div role="alert" className="mt-3 text-xs">
        <p>過去の記録を読み込めませんでした。</p>
        <button type="button" className={`${buttonClass} mt-2`} onClick={() => {
          if (inFlight.current) return;
          inFlight.current = true;
          setRetry((value) => value + 1);
        }}>過去の記録を再読み込み</button>
      </div>
      : visible.rows?.length === 0 ? <p role="status" className="mt-3 text-xs">この月の記録はありません</p>
      : <ul className="mt-3 flex min-w-0 flex-col gap-3">{visible.rows?.map((row) => <li key={row.date} className="min-w-0 rounded-lg bg-white/80 p-3">
        <p className="text-xs font-bold"><time dateTime={row.date}>{row.date}</time></p>
        <ul className="mt-2 space-y-1 text-sm text-gray-600">{[row.things1, row.things2, row.things3].map((text, index) => text?.trim() &&
          <li key={index} className="whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</li>)}</ul>
      </li>)}</ul>}
  </div>;
}
