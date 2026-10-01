"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { exportUserData } from "../exportDataAction";
import { formatExportLocalDate } from "./dataExportDate";

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
      const result = await exportUserData();
      if (result.status !== "success") {
        setNeedsLogin(result.status === "auth_required");
        setMessage(
          result.status === "auth_required"
            ? "セッションが切れました。もう一度ログインしてください。"
            : exportErrorMessage,
        );
        return;
      }

      const json = JSON.stringify(result.data, null, 2);
      const blobUrl = URL.createObjectURL(
        new Blob([json], { type: "application/json;charset=utf-8" }),
      );
      try {
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = `daily-affirmation-export-${formatExportLocalDate(result.data.exportedAt)}.json`;
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
