"use client";

import { useState, useEffect } from "react";
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
  const [totalBlooms, setTotalBlooms] = useState<number>(0);
  // ★新規追加：今日の目標点数を管理するステート（初期値はもちろん最高の「60点」です！）
  const [targetScore, setTargetScore] = useState<number>(60);

  // ★新規追加：鳥の目線(ズームアウト)状態を管理するスイッチ
  const [isBirdView, setIsBirdView] = useState<boolean>(false);

  useEffect(() => {
    const storedGrowth = localStorage.getItem("flowerGrowth");
    if (storedGrowth) {
      setGrowth(parseInt(storedGrowth, 10));
    }

    const storedTotal = localStorage.getItem("totalBlooms");
    if (storedTotal) {
      setTotalBlooms(parseInt(storedTotal, 10));
    }
  }, []);

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
    let nextGrowth = 0;

    if (growth >= flowerStages.length - 1) {
      nextGrowth = 0; // 新しい種に戻す

      const newTotal = totalBlooms + 1;
      setTotalBlooms(newTotal);
      localStorage.setItem("totalBlooms", newTotal.toString());
    } else {
      nextGrowth = growth + 1; // 成長を進める
    }

    setGrowth(nextGrowth); // 成長を更新
    localStorage.setItem("flowerGrowth", nextGrowth.toString()); // 成長を保存
  };

  return (
    <main
      className={`relative flex min-h-screen flex-col items-center justify-center p-6 pb-20 overflow-hidden transition-colors duration-1000 ${isBirdView ? "bg-sky-100" : "bg-transparent"}`}
    >
      {/* ★新規追加：鳥の目線(ズームアウト)切り替えボタン */}
      <button
        onClick={() => setIsBirdView(!isBirdView)}
        className="absolute top-6 left-6 z-50 bg-white/80 backdrop-blur-sm hover:bg-white text-sky-600 px-4 py-2 rounded-full shadow-sm border border-sky-100 font-bold tracking-wide transition-all"
      >
        {isBirdView ? "🌱 地上に戻る" : "🕊️ 鳥の目線になる"}
      </button>

      {/* ★新規追加：鳥の目線(ズームアウト)時に現れる「全体像のメッセージ」 */}
      <AnimatePresence>
        {isBirdView && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-24 z-40 ] flex flex-col items-center"
          >
            <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-lg border border-sky-100 text-center max-w-sm">
              <p className="text-sky-800 font-bold mb-3">🕊️ 空からの景色</p>
              <p className="text-sky-700/80 text-sm leading-relaxed mb-4">
                少し離れて、深呼吸してみましょう。
                <br />
                目の前の小さなことは一旦置いておいて大丈夫。
                <br />
                あなたは今日まで、こんなに素敵な軌跡を描いています。
              </p>
              <div className="bg-pink-50 rouded-2xl p-4 inline-block border border-pink-100">
                <p className="text-xs text-pink-400 font-bold mb-1">
                  今までに咲かせたお花
                </p>
                <p className="text-3xl text-pink-500 font-bold tracking-widest">
                  🌸 {totalBlooms} <span className="text-lg">個 </span>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 鳥の目線スイッチがONになると、この中身全体がギュッと縮む！ */}
      <motion.div
        animate={{
          scale: isBirdView ? 0.75 : 1,
          opacity: isBirdView ? 0.3 : 1,
          y: isBirdView ? 120 : 0,
        }}
        transition={{ duration: 1, ease: "easeInOut" }}
        className="w-full max-w-lg flex flex-col items-center z-10 originate-bottom" // ズームの起点を下にして、全体が縮むように
      >
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

        {/* ★新規追加：完璧主義ストッパー（60点スライダー） */}
        <div className="w-full max-w-md bg-white/60 backdrop-blur-md p-6 rounded-[2rem] border-2 border-white shadow-sm mb-8 flex flex-col items-center">
          <p className="text-sky-800/80 font-bold mb-4 tracking-wide text-center">
            今日の目標ラインは？
          </p>

          {/* スライダー本体 */}
          <input
            type="range"
            min="0"
            max="100"
            step="10"
            value={targetScore}
            onChange={(e) => setTargetScore(parseInt(e.target.value, 10))}
            className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />

          {/* 目盛りのラベル */}
          <div className="flex justify-between w-full text-xs text-sky-600/70 mt-2 font-medium px-1">
            <span>0点</span>
            <span className="font-bold text-sky-600 text-sm">60点(満点)</span>
            <span>100点</span>
          </div>

          {/* スライダーの値によってAI執事のメッセージと色が変わる！ */}
          <AnimatePresence mode="wait">
            <motion.div
              key={targetScore}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-5 px-4 py-3 rounded-xl text-sm font-bold text-center w-full shadow-sm transition-colors duration-300 ${
                targetScore <= 60
                  ? "bg-green-50 text-green-600 border border-green-200"
                  : targetScore < 100
                    ? "bg-yellow-50 text-yellow-600 border border-yellow-200"
                    : "bg-red-50 text-red-500 border border-red-200"
              }`}
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

        {/* アファメーションを受け取るボタン */}
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
        <div className="relative flex flex-col items-center bg-white/40 backdrop-blur-sm p-6 rounded-3xl border border-white/50 shadow-sm w-full max-w-md">
          {totalBlooms > 0 && (
            <div className="absolute top-4 right-4 bg-pink-100 border border-pink-200 text-pink-500 px-3 py-1 rounded-full text-sm font-bold shadow-sm flex items-center gap-1">
              <span>🌸</span>
              <span>{totalBlooms}</span>
            </div>
          )}

          <p className="text-sky-700/80 font-bold mb-2 tracking-wide">
            🌸 デジタル花壇 🌸
          </p>

          {/* お花の絵文字 */}
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
      </motion.div>
    </main>
  );
}
