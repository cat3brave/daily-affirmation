"use client";

import Link from "next/link";
import LogoutButton from "./LogoutButton";

type DashboardHeaderProps = {
  currentTab: "home" | "work" | "amulet";
  isBirdView: boolean;
  onToggleBirdView: () => void;
  userEmail: string | null;
  userId: string;
};

export default function DashboardHeader({
  currentTab,
  isBirdView,
  onToggleBirdView,
  userEmail,
  userId,
}: DashboardHeaderProps) {
  return (
    <header className="relative z-50 flex w-full max-w-lg flex-col items-start gap-4 sm:flex-row sm:justify-between">
      {/* ホーム画面の時だけ鳥の目線ボタンを表示する */}
      {currentTab === "home" && (
        <button
          type="button"
          onClick={onToggleBirdView}
          aria-pressed={isBirdView}
          className="max-w-full shrink-0 rounded-full border border-sky-100 bg-white/80 px-3 py-2 text-xs font-bold tracking-wide text-sky-600 shadow-sm backdrop-blur-sm transition-all hover:bg-white sm:px-4 sm:text-sm"
        >
          {isBirdView ? "🌱 地上に戻る" : "🕊️ 鳥の目線になる"}
        </button>
      )}

      <div className="flex w-full min-w-0 flex-col items-end gap-2 sm:w-auto sm:flex-1">
        <Link
          href="/privacy"
          className="inline-block rounded-md py-2 text-xs font-bold text-sky-800 underline underline-offset-2"
        >
          プライバシーとデータ
        </Link>
        <LogoutButton userId={userId} />

        {userEmail && (
          <p
            className="max-w-full truncate text-xs font-medium text-gray-500"
            title={`${userEmail.split("@")[0]} さん🌷`}
          >
            {userEmail.split("@")[0]} さん🌷
          </p>
        )}
      </div>
    </header>
  );
}
