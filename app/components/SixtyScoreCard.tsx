import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function SixtyScoreCard() {
  const [targetScore, setTargetScore] = useState(60);

  return (
    <div className="w-full max-w-md bg-white/60 backdrop-blur-md p-6 rounded-[2rem] border-2 border-white shadow-sm flex flex-col items-center mb-8">
      <p className="text-sky-800/80 font-bold mb-4 tracking-wide text-center">
        今日の目標ラインは？
      </p>
      <input
        type="range"
        min="0"
        max="100"
        step="10"
        value={targetScore}
        onChange={(e) => setTargetScore(parseInt(e.target.value, 10))}
        className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
      />
      <div
        className="w-full h-8 rounded-full mt-4 overflow-hidden relative shadow-inner"
        style={{
          background:
            "linear-gradient(to right, black, #333 10%, #FFB6C1 20%, #87CEFA 40%, #FFFFE0 60%, #98FB98 80%, #BBB 90%, white)",
        }}
      >
        <div
          className="absolute top-0 h-full w-1 bg-white/70"
          style={{ left: `calc(${targetScore}% - 2px)` }}
        />
      </div>
      <div className="flex justify-between w-full text-xs text-sky-600/70 mt-2 font-medium px-1">
        <span>0点</span>
        <span className="font-bold text-sky-600 text-sm">60点(満点)</span>
        <span>100点</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={targetScore}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-5 px-4 py-3 rounded-xl text-sm font-bold text-center w-full shadow-sm transition-colors duration-300 ${targetScore <= 60 ? "bg-green-50 text-green-600 border border-green-200" : targetScore < 100 ? "bg-yellow-50 text-yellow-600 border border-yellow-200" : "bg-red-50 text-red-500 border border-red-200"}`}
        >
          {targetScore <= 60 && "🌿 完璧です！60点で十分素晴らしいです。"}
          {targetScore > 60 &&
            targetScore < 100 &&
            "⚠️ あれ？少し背負いすぎていませんか？"}
          {targetScore === 100 &&
            "🛑 ストップ！完璧主義が顔を出しています。60点に戻しましょう！"}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
