"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import { useRouter } from "next/navigation";

const LOGIN_FAILURE_MESSAGE =
  "ログインに失敗しました。メールアドレスとパスワードを確認してください。";
const SIGN_UP_FAILURE_MESSAGE =
  "登録に失敗しました。メールアドレスやパスワードを確認してください。";
const GOOGLE_LOGIN_FAILURE_MESSAGE =
  "Googleログインに失敗しました。もう一度お試しください。";
const AUTH_MESSAGE_ID = "auth-message";
type InvalidField = "email" | "password" | null;

export default function LoginPage() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const authInFlightRef = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [message, setMessage] = useState("");
  const [invalidField, setInvalidField] = useState<InvalidField>(null);
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  // 入力チェック
  const validateEmailAndPassword = () => {
    if (!email.trim()) {
      setMessageType("error");
      setInvalidField("email");
      setMessage("メールアドレスを入力してください。");
      return false;
    }

    if (!password.trim()) {
      setMessageType("error");
      setInvalidField("password");
      setMessage("パスワードを入力してください。");
      return false;
    }

    setInvalidField(null);
    setMessage("");
    return true;
  };
  // ログインの処理
  const handleLogin = async () => {
    if (authInFlightRef.current) return;
    if (!validateEmailAndPassword()) return;

    authInFlightRef.current = true;
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessageType("error");
        setInvalidField(null);
        setMessage(LOGIN_FAILURE_MESSAGE);
      } else {
        setInvalidField(null);
        setMessage("");
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("ログイン中に想定外のエラー:", error);
      setMessageType("error");
      setInvalidField(null);
      setMessage(LOGIN_FAILURE_MESSAGE);
    } finally {
      authInFlightRef.current = false;
      setIsLoading(false);
    }
  };
  // 新規登録の処理
  const handleSignUp = async () => {
    if (authInFlightRef.current) return;
    if (!validateEmailAndPassword()) return;

    authInFlightRef.current = true;
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessageType("error");
        setInvalidField(null);
        setMessage(SIGN_UP_FAILURE_MESSAGE);
      } else {
        setMessageType("success");
        setInvalidField(null);
        setMessage(
          "確認メールを送信しました🌱 メール内のリンクを押してから、ログインしてください。",
        );
        setIsSignUpMode(false);
      }
    } catch (error) {
      console.error("登録中に想定外のエラー:", error);
      setMessageType("error");
      setInvalidField(null);
      setMessage(SIGN_UP_FAILURE_MESSAGE);
    } finally {
      authInFlightRef.current = false;
      setIsLoading(false);
    }
  };
  // Googleログインの処理
  const handleGoogleLogin = async () => {
    if (authInFlightRef.current) return;

    authInFlightRef.current = true;
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
        setInvalidField(null);
        setMessage(GOOGLE_LOGIN_FAILURE_MESSAGE);
        authInFlightRef.current = false;
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Googleログインエラー:", error);
      setMessageType("error");
      setInvalidField(null);
      setMessage(GOOGLE_LOGIN_FAILURE_MESSAGE);
      authInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  // フォーム送信の処理
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isSignUpMode) {
      await handleSignUp();
    } else {
      await handleLogin();
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
        <form onSubmit={handleSubmit}>
          {message && (
            <div
              id={AUTH_MESSAGE_ID}
              role={messageType === "success" ? "status" : "alert"}
              className={`mb-4 rounded-xl px-4 py-3 text-sm leading-relaxed ${
                messageType === "success"
                  ? "bg-green-50 text-green-700 border border-green-100"
                  : "bg-red-50 text-red-700 border border-red-100"
              }`}
            >
              {message}
            </div>
          )}

          <div className="mb-4">
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-bold text-pink-600"
            >
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              aria-invalid={invalidField === "email" ? "true" : undefined}
              aria-describedby={
                invalidField === "email" ? AUTH_MESSAGE_ID : undefined
              }
              className="w-full p-3 border border-pink-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-200 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-bold text-pink-600"
            >
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={
                isSignUpMode ? "new-password" : "current-password"
              }
              placeholder="パスワード"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              aria-invalid={invalidField === "password" ? "true" : undefined}
              aria-describedby={
                invalidField === "password" ? AUTH_MESSAGE_ID : undefined
              }
              className="w-full p-3 border border-pink-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-200 disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-3">
            {!isSignUpMode && (
              <button
                type="button"
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
              type="submit"
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
              type="button"
              onClick={() => {
                if (isLoading) return;
                setMessage("");
                setInvalidField(null);
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
        </form>
      </div>
    </div>
  );
}
