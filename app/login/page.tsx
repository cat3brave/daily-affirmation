"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "../../utils/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const router = useRouter();

  // 入力チェック
  const validateEmailAndPassword = () => {
    if (!email.trim()) {
      alert("メールアドレスを入力してください。");
      return false;
    }

    if (!password.trim()) {
      alert("パスワードを入力してください。");
      return false;
    }

    return true;
  };

  // ログインの処理
  const handleLogin = async () => {
    if (!validateEmailAndPassword()) return;

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      alert("ログイン失敗: " + error.message);
    } else {
      router.push("/dashboard");
    }
  };

  // 新規登録の処理
  const handleSignUp = async () => {
    if (!validateEmailAndPassword()) return;

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      alert("登録失敗: " + error.message);
    } else {
      alert(
        "確認メールを送信しました🌱\n\nメール内のリンクを押してから、ログインしてください。",
      );
      setIsSignUpMode(false);
    }
  };

  // Googleログインの処理
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error("Googleログインエラー:", error.message);
      alert("ログインに失敗しました。もう一度お試しください。");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-pink-50 p-4">
      <div className="bg-white p-8 rounded-[2rem] shadow-sm w-full max-w-md">
        <h1 className="text-2xl font-bold text-pink-600 mb-2 text-center">
          {isSignUpMode ? "はじめての登録🌱" : "おかえりなさい🌷"}
        </h1>

        <p className="text-sm text-pink-500/80 text-center leading-relaxed mb-6">
          {isSignUpMode ? (
            <>
              メールアドレスとパスワードを入力すると、
              <br />
              確認メールが届きます。
              <br />
              メール内のリンクを押してからログインしてください。
            </>
          ) : (
            <>
              登録済みのメールアドレス、
              <br />
              またはGoogleアカウントでログインできます。
            </>
          )}
        </p>
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
          {!isSignUpMode && (
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm"
            >
              <Image
                src="https://www.google.com/favicon.ico"
                alt="Google"
                width={20}
                height={20}
                className="w-5 h-5"
              />
              Googleでログイン
            </button>
          )}

          <button
            onClick={isSignUpMode ? handleSignUp : handleLogin}
            className="w-full bg-pink-400 text-white py-3 rounded-full font-bold hover:bg-pink-500 transition-colors"
          >
            {isSignUpMode ? "確認メールを送る" : "ログイン"}
          </button>

          <button
            onClick={() => setIsSignUpMode((prev) => !prev)}
            className="w-full text-pink-400 py-2 text-sm hover:underline"
          >
            {isSignUpMode
              ? "すでに登録済みの方はこちら"
              : "はじめての方はこちら（新規登録）"}
          </button>
        </div>
      </div>
    </div>
  );
}
