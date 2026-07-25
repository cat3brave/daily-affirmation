"use client";

import { createSupabaseBrowserClient } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const logoutErrorMessage =
  "ログアウトに失敗しました。もう一度お試しください。";

export default function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  // ブラウザ用のSupabaseの準備
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // ログアウト処理
  const handleLogout = async () => {
    if (isLoggingOut) return;

    setLogoutError("");
    setIsLoggingOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error("ログアウトに失敗しました:", error);
        setLogoutError(logoutErrorMessage);
        return;
      }

      router.push("/login"); // ログアウトしたらログイン画面へ戻す
      router.refresh(); // 画面の情報を最新にリフレッシュ
    } catch (error) {
      console.error("ログアウト中に想定外のエラー:", error);
      setLogoutError(logoutErrorMessage);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="text-sm font-medium text-gray-500 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-gray-500 transition-colors bg-white px-4 py-2 rounded-full shadow-sm"
      >
        {isLoggingOut ? "ログアウト中..." : "👋 ログアウト"}
      </button>
      {logoutError && (
        <p role="alert" className="text-xs font-bold text-red-500">
          {logoutError}
        </p>
      )}
    </div>
  );
}
