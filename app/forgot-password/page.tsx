"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import PasswordRecoveryLayout, { recoveryInputClass, recoveryButtonClass, recoveryLinkClass } from "../components/PasswordRecoveryLayout";

const sentMessage = "登録されているメールアドレスの場合、再設定用のメールが届きます。依頼したブラウザーでメール内のリンクを開いてください。";
const failedMessage = "復旧メールを依頼できませんでした。通信状況を確認し、時間をおいてもう一度お試しください。";
const limitedMessage = "依頼が制限されています。時間をおいてもう一度お試しください。";

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const notice = useRef<HTMLParagraphElement>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { mounted.current = true; setReady(true); return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (message && !busy) (invalid ? emailInput.current : notice.current)?.focus(); }, [message, invalid, busy]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || inFlight.current) return;
    const address = email.trim();
    if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError(true); setInvalid(true);
      setMessage(address ? "メールアドレスの形式を確認してください。" : "メールアドレスを入力してください。");
      emailInput.current?.focus();
      return;
    }
    inFlight.current = true;
    setBusy(true); setMessage(""); setInvalid(false);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: `${window.location.origin}/auth/recovery`,
      });
      if (!mounted.current) return;
      setError(Boolean(error));
      setMessage(error ? (error.status === 429 ? limitedMessage : failedMessage) : sentMessage);
    } catch {
      if (mounted.current) { setError(true); setMessage(failedMessage); }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <PasswordRecoveryLayout title="パスワードの復旧">
      <p className="mb-5 text-sm leading-relaxed text-pink-700">登録時のメールアドレスを入力してください。</p>
      <form onSubmit={submit} noValidate aria-busy={busy || !ready}>
        <label htmlFor="recovery-email" className="mb-2 block text-sm font-bold text-pink-600">メールアドレス</label>
        <input ref={emailInput} id="recovery-email" name="email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy || !ready} aria-invalid={invalid || undefined} aria-describedby={message ? "recovery-message" : undefined} className={recoveryInputClass} />
        {message && <p ref={notice} id="recovery-message" tabIndex={-1} role={error ? "alert" : "status"} className={`my-4 rounded-xl p-3 text-sm leading-relaxed ${error ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{message}</p>}
        <button className={`${recoveryButtonClass} mt-5`} disabled={busy || !ready} type="submit">{busy ? "依頼中..." : "復旧メールを依頼する"}</button>
        {busy && <p role="status" className="mt-3 text-sm text-pink-700">依頼を処理しています。</p>}
      </form>
      <p className="mt-4 text-center text-sm">{busy ? <span aria-disabled="true">ログイン画面へ戻る</span> : <Link className={recoveryLinkClass} href="/login">ログイン画面へ戻る</Link>}</p>
    </PasswordRecoveryLayout>
  );
}
