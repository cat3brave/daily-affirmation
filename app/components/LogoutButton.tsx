"use client";

import { useDashboardOperation, verifyDashboardOwner } from "../hooks/dashboardAuth";
import { createSupabaseBrowserClient } from "@/app/lib/supabaseClient";
import {
  hasUnsavedThreeGoodThingsDraft,
  removeUserLocalData,
} from "@/app/lib/userLocalStorage";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

const logoutErrorMessage =
  "ログアウトに失敗しました。もう一度お試しください。";
const logoutDraftConfirmation =
  "ログアウトすると、この端末の未保存の下書きが削除されます。ログアウトしますか？";

export default function LogoutButton({ userId }: { userId: string }) {
  const { capture, auth } = useDashboardOperation(userId);
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const isLoggingOutRef = useRef(false);

  // ブラウザ用のSupabaseの準備
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // ログアウト処理
  const handleLogout = async () => {
    const current = capture();
    if (!current()) return;
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    if (
      hasUnsavedThreeGoodThingsDraft(userId) &&
      !window.confirm(logoutDraftConfirmation)
    ) {
      isLoggingOutRef.current = false;
      return;
    }

    setLogoutError("");
    setIsLoggingOut(true);

    try {
      if (!await verifyDashboardOwner(auth, supabase, userId, current)) {
        if (current()) setLogoutError(logoutErrorMessage);
        return;
      }
      const { error } = await supabase.auth.signOut();
      // SIGNED_OUT may already have removed this subtree. Clean only the initiating
      // owner's cache on success, provided no intervening sign-in occurred.
      if (!current() && !(auth?.isLogoutCurrent())) return;

      if (error) {
        console.error("ログアウトに失敗しました。");
        if (current()) setLogoutError(logoutErrorMessage);
        return;
      }

      removeUserLocalData(userId);
      router.push("/login"); // ログアウトしたらログイン画面へ戻す
      router.refresh(); // 画面の情報を最新にリフレッシュ
    } catch {
      if (!current()) return;
      console.error("ログアウト中に想定外のエラーが発生しました。");
      setLogoutError(logoutErrorMessage);
    } finally {
      if (current()) { isLoggingOutRef.current = false; setIsLoggingOut(false); }
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
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
