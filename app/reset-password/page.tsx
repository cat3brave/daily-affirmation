"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import PasswordRecoveryLayout, { recoveryInputClass, recoveryButtonClass, recoveryLinkClass } from "../components/PasswordRecoveryLayout";

const authFailure = "ログイン情報を確認できません。復旧メールをもう一度依頼してください。";
const updateFailure = "パスワードを更新できませんでした。パスワードの条件や通信状況を確認し、もう一度お試しください。";
const logoutFailure = "パスワードは更新されましたが、このブラウザーのログアウトに失敗しました。もう一度ログアウトしてください。";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const identity = useRef<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const updated = useRef(false);
  const leaving = useRef(false);
  const notice = useRef<HTMLParagraphElement>(null);
  const [auth, setAuth] = useState<"checking" | "ready" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    mounted.current = true;
    const current = ++generation.current;
    let observedUser: string | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // The event is an invalidation signal; it never establishes authentication.
      if (event === "SIGNED_OUT" && leaving.current) return;
      const observed = session?.user.id ?? null;
      if (event === "SIGNED_OUT" || (identity.current && observed !== identity.current) || (observedUser && observed !== observedUser)) {
        generation.current++;
        identity.current = null;
        setAuth("invalid"); setPassword(""); setConfirmation("");
        setMessage(authFailure); setDone(false); setSignedOut(false);
        return;
      }
      // SDK initialization can emit SIGNED_IN when recovering an SSR Cookie.
      // Use it only to detect identity changes; getUser below must verify it.
      if (observed) observedUser = observed;
    });
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!mounted.current || current !== generation.current) return;
        if (error || !data.user || (observedUser && data.user.id !== observedUser)) { setAuth("invalid"); setMessage(authFailure); return; }
        identity.current = data.user.id;
        setAuth("ready");
      } catch {
        if (mounted.current && current === generation.current) { setAuth("invalid"); setMessage(authFailure); }
      }
    })();
    return () => { mounted.current = false; generation.current += 1; subscription.unsubscribe(); };
  }, [supabase]);
  useEffect(() => { if (message && !busy) notice.current?.focus(); }, [message, busy]);

  function isCurrent(version: number, user: string) {
    return mounted.current && generation.current === version && identity.current === user;
  }

  async function endSession(version: number, user: string) {
    try {
      // Verify again before signing out so a changed user is not signed out by an old result.
      const { data, error } = await supabase.auth.getUser();
      if (!isCurrent(version, user)) return;
      if (error || !data.user || data.user.id !== user) { setMessage(logoutFailure); return; }
      leaving.current = true;
      const result = await supabase.auth.signOut({ scope: "local" });
      if (!isCurrent(version, user)) return;
      if (result.error) { setMessage(logoutFailure); return; }
      setSignedOut(true);
      setMessage("パスワードを更新し、このブラウザーからログアウトしました。新しいパスワードでログインしてください。");
    } catch {
      if (isCurrent(version, user)) setMessage(logoutFailure);
    } finally {
      leaving.current = false;
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || auth !== "ready" || !identity.current || updated.current) return;
    if (!password || !confirmation) { setMessage("新しいパスワードと確認入力を入力してください。"); return; }
    if (password !== confirmation) { setMessage("パスワードと確認入力が一致しません。"); return; }
    const version = generation.current;
    const user = identity.current;
    inFlight.current = true; setBusy(true); setMessage("");
    try {
      const checked = await supabase.auth.getUser();
      if (!isCurrent(version, user)) return;
      if (checked.error || checked.data.user?.id !== user) { setAuth("invalid"); setMessage(authFailure); return; }
      const { error } = await supabase.auth.updateUser({ password });
      if (!isCurrent(version, user)) return;
      if (error) { setMessage(updateFailure); return; }
      updated.current = true;
      setPassword(""); setConfirmation(""); setDone(true);
      setMessage("パスワードを更新しました。ログアウトしています。");
      await endSession(version, user);
    } catch {
      if (isCurrent(version, user)) setMessage(updateFailure);
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function retryLogout() {
    if (inFlight.current || !identity.current) return;
    inFlight.current = true; setBusy(true);
    try { await endSession(generation.current, identity.current); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }

  return <PasswordRecoveryLayout title={done ? "パスワードの更新完了" : "新しいパスワードを設定"}>
    {auth === "checking" && <p role="status" className="mb-4 text-sm text-pink-700">ログイン情報を確認しています...</p>}
    {message && <p ref={notice} tabIndex={-1} role={done && !message.includes("失敗") ? "status" : "alert"} className="mb-4 rounded-xl bg-pink-50 p-3 text-sm leading-relaxed text-slate-700">{message}</p>}
    {!done && auth !== "invalid" && <form onSubmit={submit} noValidate aria-busy={busy}>
      <p id="password-policy" className="mb-4 text-sm text-slate-700">登録時と同じパスワード条件が適用されます。条件を満たさない場合は更新できません。</p>
      <label htmlFor="new-password" className="mb-2 block text-sm font-bold text-pink-600">新しいパスワード</label>
      <input id="new-password" name="password" type="password" autoComplete="new-password" aria-describedby="password-policy" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy || auth !== "ready"} className={`${recoveryInputClass} mb-4`} />
      <label htmlFor="confirm-password" className="mb-2 block text-sm font-bold text-pink-600">新しいパスワード（確認）</label>
      <input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={busy || auth !== "ready"} className={`${recoveryInputClass} mb-5`} />
      <button disabled={busy || auth !== "ready"} className={recoveryButtonClass}>{busy ? "更新中..." : "パスワードを更新する"}</button>
    </form>}
    {done && !signedOut && <button onClick={retryLogout} disabled={busy} className={recoveryButtonClass}>ログアウトを再試行する</button>}
    {done && signedOut && <button onClick={() => router.replace("/login")} className={recoveryButtonClass}>ログイン画面へ戻る</button>}
    {!done && !busy && <p className="mt-4 text-center"><Link href="/forgot-password" className={recoveryLinkClass}>復旧メールを再依頼する</Link></p>}
  </PasswordRecoveryLayout>;
}
