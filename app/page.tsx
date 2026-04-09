"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../utils/supabase";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      // ログイン状態を確認
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // ログインしていればダッシュボードへ
        router.push("/dashboard");
      } else {
        // ログインしていなければログイン画面へ
        router.push("/login");
      }
    };

    checkUser();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-pink-50">
      <p className="text-pink-400 font-bold animate-pulse">
        心の準備をしています...🌷
      </p>
    </div>
  );
}
