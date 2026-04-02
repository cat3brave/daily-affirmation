"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ThreeGoodThingsCard() {
  // 3つの入力欄のデータを配列（リスト）で管理します
  const [things, setThings] = useState<string[]>(["", "", ""]);
  const [isSaved, setIsSaved] = useState(false);

  // 画面が開いたときに、スマホの中に保存されている前回のデータを読み込む
  useEffect(() => {
    const savedData = localStorage.getItem("three-good-things");
    if (savedData) {
      try {
        setThings(JSON.parse(savedData));
      } catch (e) {
        console.error("データの読み込みに失敗しました");
      }
    }
  }, []);

  // 文字が入力されたときに、配列の該当する場所だけを書き換える関数
  const handleChange = (index: number, value: string) => {
    const newThings = [...things];
    newThings[index] = value;
    setThings(newThings);
  };

  // 保存ボタンを押したときの処理
  const handleSave = () => {
    // 配列データを文字（JSON）に変換して、スマホ（localStorage）に保存
    localStorage.setItem("three-good-things", JSON.stringify(things));
    setIsSaved(true);

    // 3秒後に「保存しました」のメッセージを消す
    setTimeout(() => {
      setIsSaved(false);
    }, 3000);
  };

  return (
    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-[2rem] shadow-sm border border-pink-50 w-full mb-6 flex flex-col items-center">
      <h3 className="text-pink-700 font-bold mb-2">🌷 3つのよかったこと</h3>
      <p className="text-pink-600/80 text-xs text-center mb-6">
        今日あった、どんなに小さなことでも大丈夫。
        <br />
        よかったことや、感謝したいことを3つ書いてみましょう。
      </p>

      <div className="w-full flex flex-col gap-3 mb-6">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="text-pink-400 font-bold mt-2">{index + 1}.</span>
            <textarea
              value={things[index]}
              onChange={(e) => handleChange(index, e.target.value)}
              placeholder={`（例：${["美味しいコーヒーを飲んだ", "天気が良くて気持ちよかった", "ゆっくり休めた"][index]}）`}
              className="w-full bg-pink-50/50 border border-pink-100 rounded-xl p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-200 resize-none h-16"
            />
          </div>
        ))}
      </div>

      <div className="relative w-full flex justify-center h-10">
        <AnimatePresence mode="wait">
          {!isSaved ? (
            <motion.button
              key="save-button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={handleSave}
              className="bg-pink-400 hover:bg-pink-500 text-white px-8 py-2 rounded-full font-bold transition-colors shadow-sm"
            >
              記録する
            </motion.button>
          ) : (
            <motion.p
              key="saved-message"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-pink-600 font-bold flex items-center h-full"
            >
              ✨ 保存しました！今日もお疲れ様です ✨
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
