"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "./lib/supabaseClient";

export default function LandingPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const pushIfMounted = (path: string) => {
      if (isMounted) {
        router.push(path);
      }
    };

    const checkUser = async () => {
      try {
        // ログイン状態を確認
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("セッション確認に失敗しました:", error);
          pushIfMounted("/login");
          return;
        }

        if (session) {
          // ログインしていればダッシュボードへ
          pushIfMounted("/dashboard");
        } else {
          // ログインしていなければログイン画面へ
          pushIfMounted("/login");
        }
      } catch (error) {
        console.error("セッション確認中に想定外のエラー:", error);
        pushIfMounted("/login");
      }
    };

    checkUser();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-pink-50">
      <p
        role="status"
        aria-live="polite"
        className="text-pink-400 font-bold animate-pulse"
      >
        心の準備をしています...🌷
      </p>
    </div>
  );
}
