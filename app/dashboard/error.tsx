"use client";

import Link from "next/link";
import { useEffect } from "react";

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("dashboardで予期しないエラーが発生しました:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-sky-50 p-6 text-sky-700">
      <section
        role="alert"
        className="w-full max-w-md rounded-[2rem] border border-sky-100 bg-white/90 p-8 text-center shadow-sm"
      >
        <h1 className="mb-3 text-2xl font-bold text-sky-700">
          画面を表示できませんでした
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-sky-600/80">
          一時的な問題かもしれません。もう一度お試しください。
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-full bg-sky-400 px-5 py-3 font-bold text-white shadow-sm transition-colors hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:ring-offset-2"
          >
            もう一度試す
          </button>
          <Link
            href="/login"
            className="w-full rounded-full border border-sky-100 bg-white px-5 py-3 text-sm font-bold text-sky-500 transition-colors hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:ring-offset-2"
          >
            ログイン画面へ戻る
          </Link>
        </div>
      </section>
    </main>
  );
}
