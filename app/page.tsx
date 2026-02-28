"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { generateAffirmation } from "./actions";

const flowerStages = ["🌰", "🌱", "🌿", "🌷", "🌸"];
const growthMessages = [
  "種を植えました。お散歩して育てよう！",
  "芽が出ました！その調子！",
  "葉っぱが育っています。いいペースですね！",
  "つぼみがつきました！あともう少し！",
  "満開のお花が咲きました！今日も素晴らしい一日です！",
];

export default function Home() {
  const [text, setText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [growth, setGrowth] = useState<number>(0);

  const handleClick = async () => {
    if (isLoading) return; // 連打防止
    setIsLoading(true);
    setText(""); // 古い言葉を一旦消す

    try {
      const newText = await generateAffirmation();
      setText(newText);
    } catch (error) {
      setText("深呼吸して、もう一度試してみてくださいね。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleWalk = () => {
    if (growth >= flowerStages.length - 1) {
      setGrowth(0); // 成長が最大になったらリセット
    } else {
      setGrowth(growth + 1); // 成長を進める
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 pb-20">
      {/* 肯定文の表示エリア */}
      <div className="h-64 flex items-center justify-center mb-8 w-full max-w-lg bg-white/60 backdrop-blur-md rounded-[3rem] p-8 shadow-sm border-2 border-white">
        <AnimatePresence mode="wait">
          {isLoading ? (
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
            <p className="text-blue-400/70 text-lg">
              ボタンを押して、言葉を受け取ってください
            </p>
          )}
        </AnimatePresence>
      </div>

      {/* 動きを止めた、濃いスカイブルーのボタン */}
      <div className="mb-12">
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
      </div>

      {/*デジタル花壇エリア*/}
      <div className="flex flex-col items-center bg-white/40 backdrop-blur-sm p-6 rounded-3xl border border-white/50 shadow-sm w-full max-w-md">
        <p className="text-sky-700/80 font-bold mb-2 tracking-wide">
          🌸 デジタル花壇 🌸
        </p>

        {/* お花の絵文字（ポンッと弾むアニメーション付き） */}
        <motion.div
          key={growth}
          initial={{ scale: 0.5, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="text-7xl my-4"
        >
          {flowerStages[growth]}
        </motion.div>

        {/* 成長メッセージ */}
        <p className="text-sky-800/80 text-sm font-medium mb-6 text-center h-5">
          {growthMessages[growth]}
        </p>

        {/* 水やり・お散歩ボタン */}
        <motion.button
          whileHover={{ scale: 1.05, backgroundColor: "#f0fbf4" }}
          whileTap={{ scale: 0.95 }}
          onClick={handleWalk}
          className="px-8 py-3 bg-white text-green-600 rounded-full shadow-sm transition-colors duration-300 text-base font-bold tracking-widest border-2 border-green-200"
        >
          {growth >= flowerStages.length - 1
            ? "新しい種を植える 🌱"
            : "今日もお散歩した！ 💧"}
        </motion.button>
      </div>
    </main>
  );
}
