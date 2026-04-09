"use client";

import { useState } from "react";
// 👇 通信パイプを呼び出します（パスは ../../utils/supabase です）
import { supabase } from "../../utils/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  // ログインの処理
  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      alert("ログイン失敗: " + error.message);
    } else {
      router.push("/dashboard"); // 成功したらリビングへ案内！
    }
  };

  // 新規登録の処理
  const handleSignUp = async () => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) {
      alert("登録失敗: " + error.message);
    } else {
      alert("登録成功！そのままログインできます🌷");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-pink-50 p-4">
      <div className="bg-white p-8 rounded-[2rem] shadow-sm w-full max-w-md">
        <h1 className="text-2xl font-bold text-pink-600 mb-6 text-center">
          おかえりなさい🌷
        </h1>

        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-4 p-3 border border-pink-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-200"
        />

        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-6 p-3 border border-pink-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-200"
        />

        <div className="flex flex-col gap-3">
          <button
            onClick={handleLogin}
            className="w-full bg-pink-400 text-white py-3 rounded-full font-bold hover:bg-pink-500 transition-colors"
          >
            ログイン
          </button>

          <button
            onClick={handleSignUp}
            className="w-full text-pink-400 py-2 text-sm hover:underline"
          >
            はじめての方はこちら（新規登録）
          </button>
        </div>
      </div>
    </div>
  );
}
