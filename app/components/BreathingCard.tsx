"use client";

import { useState, useEffect } from "react";
import { motion, Variants } from "framer-motion";

export default function BreathingCard() {
  const [phase, setPhase] = useState<
    "idle" | "inhale" | "hold" | "exhale" | "completed"
  >("idle");
  const [timeLeft, setTimeLeft] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);

  // 🔴 修正ポイント：1秒ごとに「時間だけを減らす」シンプルな設計に変更！
  useEffect(() => {
    if (phase === "idle" || phase === "completed") return;

    // まだ時間が残っている場合は、1秒後に -1 する
    if (timeLeft > 0) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
    // 🔴 時間が0になったら、次の行動（フェーズ切り替え）を決める！
    else {
      if (phase === "inhale") {
        setPhase("hold");
        setTimeLeft(4); // 止める時間（4秒）
      } else if (phase === "hold") {
        setPhase("exhale");
        setTimeLeft(8); // 吐く時間（8秒）
      } else if (phase === "exhale") {
        const nextCount = cycleCount + 1;
        if (nextCount >= 3) {
          setPhase("completed");
        } else {
          setCycleCount(nextCount); // 回数を増やす
          setPhase("inhale");
          setTimeLeft(4); // 吸う時間（4秒）に戻る
        }
      }
    }
  }, [phase, timeLeft, cycleCount]);

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
      transition: { duration: 4, ease: "linear" },
    },
    exhale: {
      scale: 1,
      backgroundColor: "#e0f2fe",
      transition: { duration: 8, ease: "linear" },
    },
    completed: {
      scale: 1,
      backgroundColor: "#bbf7d0",
      transition: { duration: 2 },
    },
  };

  const messages = {
    idle: "準備ができたらスタート",
    inhale: "鼻から深く吸って...",
    hold: "そのまま止めて...",
    exhale: "口からゆっくり吐いて...",
    completed: "お疲れ様でした。少し心は落ち着きましたか？",
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-[2rem] shadow-sm border border-sky-50 w-full mb-6 flex flex-col items-center">
      <h3 className="text-sky-800 font-bold mb-2">🎈 4-4-8 深呼吸ナビ</h3>
      <p className="text-sky-600/80 text-xs text-center mb-8 h-8 whitespace-pre-wrap">
        {phase === "completed"
          ? "深呼吸のワークが完了しました🌿"
          : "心を落ち着かせる深呼吸を、\n一緒に3回行いましょう。"}
      </p>

      <div className="relative w-32 h-32 flex items-center justify-center mb-8">
        <motion.div
          variants={circleVariants}
          initial="idle"
          animate={phase}
          className="absolute w-20 h-20 rounded-full opacity-60"
        />
        <div className="z-10 text-sky-800 font-bold flex flex-col items-center">
          {phase === "idle" || phase === "completed" ? (
            <span className="text-xl">🌿</span>
          ) : (
            <>
              <span className="text-2xl">{timeLeft}</span>
              <span className="text-[0.6rem] mt-1 text-sky-600/70">
                {cycleCount + 1} / 3回目
              </span>
            </>
          )}
        </div>
      </div>

      <p className="text-sky-700 font-bold mb-6 h-6 text-center text-sm">
        {messages[phase]}
      </p>

      {phase === "idle" ? (
        <button
          onClick={() => {
            setCycleCount(0);
            setPhase("inhale");
            setTimeLeft(4); // 🔴 ボタンを押した時に最初の4秒をセットする
          }}
          className="bg-sky-400 hover:bg-sky-500 text-white px-6 py-2 rounded-full font-bold transition-colors shadow-sm"
        >
          深呼吸をはじめる
        </button>
      ) : phase === "completed" ? (
        <button
          onClick={() => {
            setCycleCount(0);
            setPhase("idle");
          }}
          className="bg-green-400 hover:bg-green-500 text-white px-6 py-2 rounded-full font-bold transition-colors shadow-sm text-sm"
        >
          もう一度おこなう
        </button>
      ) : (
        <button
          onClick={() => {
            setPhase("idle");
            setCycleCount(0);
          }}
          className="bg-gray-100 hover:bg-gray-200 text-gray-500 px-6 py-2 rounded-full font-bold transition-colors text-sm"
        >
          ストップ
        </button>
      )}
    </div>
  );
}
