"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { generateAffirmation } from "./actions"; // ★先ほど作ったAI関数を読み込む

export default function Home() {
  const [text, setText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleClick = async () => {
    if (isLoading) return; // 連打防止
    setIsLoading(true);
    setText(""); // 古い言葉を一旦消す

    try {
      // ★AI執事に新しい肯定文を作ってもらう
      const newText = await generateAffirmation();
      setText(newText);
    } catch (error) {
      setText("深呼吸して、もう一度試してみてくださいね。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      {/* 肯定文の表示エリア（雲のような半透明ボックス） */}
      <div className="h-64 flex items-center justify-center mb-10 w-full max-w-lg bg-white/60 backdrop-blur-md rounded-[3rem] p-8 shadow-sm border-2 border-white">
        <AnimatePresence mode="wait">
          {isLoading ? (
            // ★AIが考えている間の表示
            <motion.p
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-lg text-blue-400/70 animate-pulse tracking-widest"
            >
              言葉を紡いでいます...
            </motion.p>
          ) : text ? (
            // AIから受け取った言葉の表示
            <motion.p
              key={text}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="text-xl md:text-2xl text-blue-800/80 font-medium text-center leading-loose tracking-widest"
            >
              {text}
            </motion.p>
          ) : (
            // 初期状態
            <p className="text-blue-400/70 text-lg">
              ボタンを押して、言葉を受け取ってください
            </p>
          )}
        </AnimatePresence>
      </div>

      {/* 動きを止めた、濃いスカイブルーのボタン */}
      <motion.button
        whileHover={{
          scale: isLoading ? 1 : 1.05,
          backgroundColor: isLoading ? "#0ea5e9" : "#0284c7",
          boxShadow: isLoading
            ? "none"
            : "0px 10px 25px rgba(14, 165, 233, 0.4)",
        }}
        whileTap={{ scale: isLoading ? 1 : 0.95 }}
        onClick={handleClick}
        disabled={isLoading}
        className={`px-12 py-5 bg-sky-500 text-white rounded-full shadow-md transition-colors duration-300 text-lg font-bold tracking-widest border-4 border-sky-500 ${
          isLoading ? "opacity-70 cursor-not-allowed" : ""
        }`}
      >
        {isLoading ? "受け取り中..." : "言葉を受け取る"}
      </motion.button>
    </main>
  );
}
