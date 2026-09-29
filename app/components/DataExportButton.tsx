"use client";

import Link from "next/link";
import { useRef, useState } from "react";

const exportErrorMessage =
  "データを書き出せませんでした。時間をおいてもう一度お試しください。";

export default function DataExportButton() {
  const requestInProgress = useRef(false);
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  const handleExport = async () => {
    if (requestInProgress.current) return;
    requestInProgress.current = true;
    setIsExporting(true);
    setMessage("");
    setNeedsLogin(false);

    try {
      const response = await fetch("/api/export-data", {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        setNeedsLogin(response.status === 401);
        setMessage(
          response.status === 401
            ? "セッションが切れました。もう一度ログインしてください。"
            : exportErrorMessage,
        );
        return;
      }

      const blobUrl = URL.createObjectURL(await response.blob());
      try {
        const disposition = response.headers.get("Content-Disposition") ?? "";
        const matchedName = disposition.match(
          /filename="(daily-affirmation-data-\d{4}-\d{2}-\d{2}\.json)"/,
        )?.[1];
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = matchedName ?? "daily-affirmation-data.json";
        link.click();
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
      setMessage("保存済みデータを書き出しました。");
    } catch {
      setMessage(exportErrorMessage);
    } finally {
      requestInProgress.current = false;
      setIsExporting(false);
    }
  };

  return (
    <div className="flex max-w-[150px] flex-col items-end gap-1 text-right">
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        className="rounded-full border border-sky-100 bg-white px-3 py-2 text-xs font-bold text-sky-700 shadow-sm transition-colors hover:bg-sky-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isExporting ? "書き出し中..." : "データを書き出す"}
      </button>
      <p className="text-[10px] leading-tight text-gray-500">
        Supabaseへ保存済みのデータのみ
      </p>
      {message && (
        <p
          role={needsLogin || message === exportErrorMessage ? "alert" : "status"}
          aria-live={needsLogin || message === exportErrorMessage ? undefined : "polite"}
          className={`text-xs font-bold ${needsLogin || message === exportErrorMessage ? "text-red-600" : "text-emerald-700"}`}
        >
          {message}
          {needsLogin && (
            <Link href="/login" className="ml-1 underline">
              ログイン画面へ
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
