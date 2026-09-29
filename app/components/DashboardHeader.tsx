"use client";

import LogoutButton from "./LogoutButton";
import DataExportButton from "./DataExportButton";

type DashboardHeaderProps = {
  currentTab: "home" | "work" | "amulet";
  isBirdView: boolean;
  onToggleBirdView: () => void;
  userEmail: string | null;
};

export default function DashboardHeader({
  currentTab,
  isBirdView,
  onToggleBirdView,
  userEmail,
}: DashboardHeaderProps) {
  return (
    <header className="absolute top-4 z-50 flex w-full max-w-lg items-start justify-between gap-2 px-3 sm:px-6">
      {/* 👇 ホーム画面の時だけボタンを表示、それ以外は透明な空箱を置く */}
      {currentTab === "home" ? (
        <button
          type="button"
          onClick={onToggleBirdView}
          aria-pressed={isBirdView}
          className="shrink-0 rounded-full border border-sky-100 bg-white/80 px-3 py-2 text-xs font-bold tracking-wide text-sky-600 shadow-sm backdrop-blur-sm transition-all hover:bg-white sm:px-4 sm:text-sm"
        >
          {isBirdView ? "🌱 地上に戻る" : "🕊️ 鳥の目線になる"}
        </button>
      ) : (
        <div className="w-[110px] shrink-0 sm:w-[120px]"></div>
      )}

      <div className="flex min-w-0 flex-col items-end gap-2">
        <div className="flex flex-wrap justify-end gap-2">
          <DataExportButton />
          <LogoutButton />
        </div>

        {userEmail && (
          <p className="text-xs text-gray-500 font-medium truncate max-w-[120px]">
            {userEmail.split("@")[0]} さん🌷
          </p>
        )}
      </div>
    </header>
  );
}
