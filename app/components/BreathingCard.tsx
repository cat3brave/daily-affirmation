"use client";

import { useState, useEffect } from "react";
import { motion, Variants } from "framer-motion";

export default function BreathingCard() {
  const [phase, setPhase] = useState<"idle" | "inhale" | "hold" | "exhale">(
    "idle",
  );
  const [timeLeft, setTimeLeft] = useState(0);

  // 🔴 【新規追加】フェーズが変わったタイミングでスマホを振動させる！
  useEffect(() => {
    // ブラウザがバイブレーション機能を持っているかチェック
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      if (phase === "idle") {
        navigator.vibrate(0); // 停止
      } else if (phase === "inhale") {
        // 吸う始まり：短く1回「ブルッ」
        navigator.vibrate(100);
      } else if (phase === "hold") {
        // 息を止める：短く2回「ブルッ、ブルッ」
        navigator.vibrate([100, 100, 100]);
      } else if (phase === "exhale") {
        // 吐く始まり：少し長く1回「ブーッ」
        navigator.vibrate(400);
      }
    }
  }, [phase]);

  // 呼吸のフェーズ（吸う・止める・吐く）を自動で切り替えるタイマー
  useEffect(() => {
    if (phase === "idle") return;

    let duration = 0;
    let nextPhase: "idle" | "inhale" | "hold" | "exhale" = "idle";

    // フェーズごとの秒数と、次のアクションを設定
    if (phase === "inhale") {
      duration = 4;
      nextPhase = "hold";
    }
    if (phase === "hold") {
      duration = 7;
      nextPhase = "exhale";
    }
    if (phase === "exhale") {
      duration = 8;
      nextPhase = "idle";
    } // 1周で一旦停止

    setTimeLeft(duration);

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPhase(nextPhase);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  // アニメーションの動き（円の大きさと色）
  const circleVariants: Variants = {
    idle: { scale: 1, backgroundColor: "#e0f2fe", transition: { duration: 1 } },
    inhale: {
      scale: 1.8,
      backgroundColor: "#bae6fd",
      transition: { duration: 4, ease: "linear" },
    },
    hold: {
      scale: 1.8,
      backgroundColor: "#fde047",
      transition: { duration: 7, ease: "linear" },
    },
    exhale: {
      scale: 1,
      backgroundColor: "#e0f2fe",
      transition: { duration: 8, ease: "linear" },
    },
  };

  const messages = {
    idle: "準備ができたらスタート",
    inhale: "鼻から深く吸って...",
    hold: "息を止めて...",
    exhale: "口からゆっくり吐いて...",
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-[2rem] shadow-sm border border-sky-50 w-full mb-6 flex flex-col items-center">
      <h3 className="text-sky-800 font-bold mb-2">🎈 4-7-8 深呼吸ナビ</h3>
      {/* 🔴 説明文も少しアプリっぽく変更しました */}
      <p className="text-sky-600/80 text-xs text-center mb-8">
        目を閉じて、スマホの振動に合わせて
        <br />
        呼吸してみましょう。
      </p>

      {/* 呼吸に合わせて動く円 */}
      <div className="relative w-32 h-32 flex items-center justify-center mb-8">
        <motion.div
          variants={circleVariants}
          initial="idle"
          animate={phase}
          className="absolute w-20 h-20 rounded-full opacity-60"
        />
        {/* 真ん中のテキスト（秒数） */}
        <div className="z-10 text-sky-800 font-bold text-xl">
          {phase === "idle" ? "🌿" : timeLeft}
        </div>
      </div>

      <p className="text-sky-700 font-bold mb-6 h-6">{messages[phase]}</p>

      {phase === "idle" ? (
        <button
          onClick={() => setPhase("inhale")}
          className="bg-sky-400 hover:bg-sky-500 text-white px-6 py-2 rounded-full font-bold transition-colors shadow-sm"
        >
          深呼吸をはじめる
        </button>
      ) : (
        <button
          onClick={() => setPhase("idle")}
          className="bg-gray-100 hover:bg-gray-200 text-gray-500 px-6 py-2 rounded-full font-bold transition-colors text-sm"
        >
          ストップ
        </button>
      )}
    </div>
  );
}
