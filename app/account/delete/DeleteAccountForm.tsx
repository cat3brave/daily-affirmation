"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DataExportButton from "../../components/DataExportButton";
import { createSupabaseBrowserClient } from "../../lib/supabaseClient";
import { markAccountDeleted } from "../../lib/deletedAccount";
import { removeUserLocalData } from "../../lib/userLocalStorage";
import type { DeletionResult } from "../../lib/accountDeletion";
const buttonClass = "rounded-full border border-sky-300 px-5 py-3 font-bold text-sky-900 disabled:opacity-50";

export default function DeleteAccountForm({ enabled, signedIn, hasReceipt }: {
  enabled: boolean; signedIn: boolean; hasReceipt: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"review" | "pending" | "ready" | "unknown" | "succeeded">("review");
  const [busy, setBusy] = useState(hasReceipt && enabled);
  const [backup, setBackup] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [operationId, setOperationId] = useState("");
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const cancelRef = useRef<HTMLAnchorElement>(null);
  const initialCheck = useRef(false);

  async function applyResult(result: DeletionResult) {
    if (result.operationId) setOperationId(result.operationId);
    if (result.status === "succeeded" && result.cleanupUserId) {
      const marked = markAccountDeleted(result.cleanupUserId);
      const removed = removeUserLocalData(result.cleanupUserId);
      try {
        const client = createSupabaseBrowserClient();
        // Local cleanup only: do not sign out another account after an old receipt is restored.
        const { data } = await client.auth.getSession();
        if (data.session?.user.id === result.cleanupUserId) await client.auth.signOut({ scope: "local" });
      } catch { /* Account deletion remains successful even if local sign-out fails. */ }
      setPhase("succeeded");
      if (!marked || !removed) {
        setMessage("アカウントの削除は完了しました。このブラウザーの保存データを消去できませんでした。ブラウザーのサイトデータを確認してください。");
      } else {
        router.replace("/login?accountDeleted=1");
        router.refresh();
      }
      return;
    }
    if (result.status === "pending" || result.status === "ready") {
      setPhase(result.status);
      setMessage(result.status === "pending" ? "確認済みメールアドレスへコードを送信しました。" : "本人確認ができました。削除する場合は、最後の確認に進んでください。");
    } else if (["processing", "unknown", "verifying", "busy"].includes(result.status)) {
      setPhase("unknown");
      setMessage("処理の状態を確認してください。通信が途切れた場合、削除結果がまだ分からないことがあります。削除ボタンの再送信はしません。");
    } else if (result.status === "cancelled") {
      router.replace("/dashboard");
    } else {
      setMessage(result.status === "expired" ? "確認の有効期限が切れました。未送信の場合は、本人確認からやり直してください。" :
        result.status === "auth_required" ? "ログインが必要です。" :
        result.status === "unavailable" ? "現在、アカウント削除は利用できません。" : "確認できませんでした。入力内容を確認してください。");
      if (result.status === "expired") setPhase("review");
    }
  }
  async function submit(action: "prepare" | "verify" | "delete" | "status" | "cancel") {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/account/delete/request", {
        method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
        body: JSON.stringify({ action, ...(action === "verify" ? { token } : {}), ...(action === "delete" ? { confirmed } : {}) }),
      });
      const result = await response.json() as DeletionResult;
      if (mounted.current) await applyResult(result);
    } catch {
      if (mounted.current) {
        setPhase("unknown");
        setMessage("通信が途切れました。結果を確認するまで、このブラウザーのデータを保持します。");
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) { setBusy(false); setToken(""); }
    }
  }
  useEffect(() => {
    mounted.current = true;
    cancelRef.current?.focus();
    if (hasReceipt && enabled && !initialCheck.current) {
      initialCheck.current = true;
      void submit("status");
    }
    return () => { mounted.current = false; };
    // Restore once; never start or retry deletion on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (message) messageRef.current?.focus(); }, [message]);

  return <main id="main-content" tabIndex={-1} className="min-h-screen px-4 py-8">
    <article className="mx-auto max-w-xl space-y-5 rounded-3xl bg-white p-6 text-slate-700 shadow-sm">
      <h1 className="text-2xl font-bold text-sky-900">アカウントを削除する</h1>
      <p>アカウントと、保存済みのToDo・お気に入り・3つのよかったこと・花の記録・プロフィールを削除します。この操作は取り消せません。</p>
      <p>このブラウザーのあなたのキャッシュと未保存の下書きも消去します。Googleアカウント自体、書き出したJSON、他端末の保存物は削除されません。</p>
      {!busy && phase !== "unknown" && phase !== "succeeded" && <Link ref={cancelRef} className={buttonClass + " inline-block"} href="/dashboard" onClick={event => {
        if (phase !== "review") { event.preventDefault(); void submit("cancel"); }
      }}>削除せず戻る</Link>}
      {!enabled ? <p role="status">現在、アカウント削除は準備中です。保存済みのデータは引き続き利用できます。</p> : <>
        {!signedIn && !hasReceipt && <Link href="/login" className="underline">ログインして本人確認に進む</Link>}
        {signedIn && phase === "review" && <fieldset disabled={busy} className="space-y-4">
          <legend className="font-bold">削除前の確認</legend>
          <DataExportButton />
          <p>JSONには未保存の下書きは含まれません。必要な下書きは別途控えてください。JSONを読み込んで復元する機能はありません。</p>
          <label className="flex items-start gap-2"><input type="checkbox" checked={backup} onChange={e => setBackup(e.target.checked)} />必要なデータを保存した、または保存せず削除することを選びます。</label>
          <button className={buttonClass} disabled={!backup} onClick={() => void submit("prepare")}>メールで本人確認する</button>
        </fieldset>}
        {phase === "pending" && <form className="space-y-4" onSubmit={e => { e.preventDefault(); void submit("verify"); }}>
          <label className="block">確認コード<input className="mt-2 block w-full rounded border p-3" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required value={token} onChange={e => setToken(e.target.value)} disabled={busy} /></label>
          <button className={buttonClass} disabled={busy}>コードを確認する</button>
        </form>}
        {phase === "ready" && <fieldset disabled={busy} className="space-y-4">
          <legend className="font-bold">最終確認</legend>
          <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />アカウントと上記のデータを削除し、元に戻せないことを確認しました。</label>
          <button className="rounded-full bg-red-700 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={!confirmed} onClick={() => void submit("delete")}>アカウントとデータを削除する</button>
        </fieldset>}
        {phase === "unknown" && <><button className={buttonClass} disabled={busy} onClick={() => void submit("status")}>処理結果を確認する</button><p>確認できない場合は、操作番号を控えてお問い合わせください。</p></>}
        {phase === "succeeded" && <Link href="/login?accountDeleted=1" className="underline">ログイン画面へ</Link>}
      </>}
      {busy && <p role="status">処理中です。送信後に画面を閉じても処理は取り消されません。</p>}
      {message && <p ref={messageRef} tabIndex={-1} role="status" className="break-words font-bold">{message}</p>}
      {operationId && <p className="break-all text-xs">操作番号: {operationId}</p>}
    </article>
  </main>;
}
