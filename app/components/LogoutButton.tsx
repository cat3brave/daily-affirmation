"use client";

import { createSupabaseBrowserClient } from "@/app/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  // ブラウザ用のSupabaseの準備
  const supabase = createSupabaseBrowserClient();

  // ログアウト処理
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login"); // ログアウトしたらログイン画面へ戻す
    router.refresh(); // 画面の情報を最新にリフレッシュ
  };

  return (
    <button
      onClick={handleLogout}
      className="text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors bg-white px-4 py-2 rounded-full shadow-sm"
    >
      👋 ログアウト
    </button>
  );
}
