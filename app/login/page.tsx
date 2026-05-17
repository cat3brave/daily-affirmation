"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "../../utils/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  // 入力チェック
  const validateEmailAndPassword = () => {
    if (!email.trim()) {
      setMessageType("error");
      setMessage("メールアドレスを入力してください。");
      return false;
    }

    if (!password.trim()) {
      setMessageType("error");
      setMessage("パスワードを入力してください。");
      return false;
    }

    setMessage("");
    return true;
  };
  // ログインの処理
  const handleLogin = async () => {
    if (isLoading) return;
    if (!validateEmailAndPassword()) return;

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessageType("error");
        setMessage(
          "ログインに失敗しました。メールアドレスとパスワードを確認してください。",
        );
      } else {
        setMessage("");
        router.push("/dashboard");
      }
    } finally {
      setIsLoading(false);
    }
  };
  // 新規登録の処理
  const handleSignUp = async () => {
    if (isLoading) return;
    if (!validateEmailAndPassword()) return;

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessageType("error");
        setMessage(
          "登録に失敗しました。メールアドレスやパスワードを確認してください。",
        );
      } else {
        setMessageType("success");
        setMessage(
          "確認メールを送信しました🌱 メール内のリンクを押してから、ログインしてください。",
        );
        setIsSignUpMode(false);
      }
    } finally {
      setIsLoading(false);
    }
  };
  // Googleログインの処理
  const handleGoogleLogin = async () => {
    if (isLoading) return;

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error("Googleログインエラー:", error.message);
        setMessageType("error");
        setMessage("Googleログインに失敗しました。もう一度お試しください。");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Googleログインエラー:", error);
      setMessageType("error");
      setMessage("Googleログインに失敗しました。もう一度お試しください。");
      setIsLoading(false);
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

        {message && (
          <div
            className={`mb-4 rounded-xl px-4 py-3 text-sm leading-relaxed ${
              messageType === "success"
                ? "bg-green-50 text-green-700 border border-green-100"
                : "bg-red-50 text-red-700 border border-red-100"
            }`}
          >
            {message}
          </div>
        )}

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
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Image
                src="https://www.google.com/favicon.ico"
                alt="Google"
                width={20}
                height={20}
                className="w-5 h-5"
              />
              {isLoading ? "送信中..." : "Googleでログイン"}
            </button>
          )}

          <button
            onClick={isSignUpMode ? handleSignUp : handleLogin}
            disabled={isLoading}
            className="w-full bg-pink-400 text-white py-3 rounded-full font-bold hover:bg-pink-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading
              ? "送信中..."
              : isSignUpMode
                ? "確認メールを送る"
                : "ログイン"}
          </button>
          <button
            onClick={() => {
              if (isLoading) return;
              setMessage("");
              setIsSignUpMode((prev) => !prev);
            }}
            disabled={isLoading}
            className="w-full text-pink-400 py-2 text-sm hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
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
