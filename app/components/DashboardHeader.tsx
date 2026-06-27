"use client";

import LogoutButton from "./LogoutButton";

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
    <header className="w-full max-w-lg absolute top-4 flex justify-between items-start px-6 z-50">
      {/* 👇 ホーム画面の時だけボタンを表示、それ以外は透明な空箱を置く */}
      {currentTab === "home" ? (
        <button
          onClick={onToggleBirdView}
          className="bg-white/80 backdrop-blur-sm hover:bg-white text-sky-600 px-4 py-2 rounded-full shadow-sm border border-sky-100 font-bold tracking-wide transition-all text-sm"
        >
          {isBirdView ? "🌱 地上に戻る" : "🕊️ 鳥の目線になる"}
        </button>
      ) : (
        <div className="w-[120px]"></div>
      )}

      <div className="flex flex-col items-end gap-1">
        <LogoutButton />

        {userEmail && (
          <p className="text-xs text-gray-500 font-medium truncate max-w-[120px]">
            {userEmail.split("@")[0]} さん🌷
          </p>
        )}
      </div>
    </header>
  );
}
