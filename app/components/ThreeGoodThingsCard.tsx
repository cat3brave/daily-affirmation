"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function ThreeGoodThingsCard() {
  const [things, setThings] = useState<string[]>(["", "", ""]);
  const [isSaved, setIsSaved] = useState(false);
  const [allRecords, setAllRecords] = useState<Record<string, string[]>>({});

  // 🔴 新規追加：ユーザーがタップした「日付」を覚えておくための状態
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const getTodayDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getPast14Days = () => {
    const dates = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
    }
    return dates;
  };

  useEffect(() => {
    const savedData = localStorage.getItem("three-good-things-history");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setAllRecords(parsed);

        const today = getTodayDate();
        if (parsed[today]) {
          setThings(parsed[today]);
        }
      } catch (e) {
        console.error("データの読み込みに失敗しました");
      }
    }
  }, []);

  const handleChange = (index: number, value: string) => {
    const newThings = [...things];
    newThings[index] = value;
    setThings(newThings);
  };

  const handleSave = () => {
    const today = getTodayDate();
    const updatedRecords = { ...allRecords, [today]: things };

    setAllRecords(updatedRecords);
    localStorage.setItem(
      "three-good-things-history",
      JSON.stringify(updatedRecords),
    );

    setIsSaved(true);
    // 保存したと同時に、今日の日付の記録を開いて見せる！
    setSelectedDate(today);

    setTimeout(() => {
      setIsSaved(false);
    }, 3000);
  };

  const past14Days = getPast14Days();

  return (
    // 🔴 下のメニューバーに隠れないよう、一番下の余白を「mb-6」から「mb-24」に増やしました！
    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-[2rem] shadow-sm border border-pink-50 w-full mb-24 flex flex-col items-center">
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

      <div className="relative w-full flex justify-center h-10 mb-4">
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

      <div className="w-full bg-pink-50/30 rounded-xl p-4 flex flex-col items-center">
        <p className="text-[0.65rem] text-pink-400 font-bold mb-2">
          🌱 最近の記録（2週間）
        </p>
        <div className="flex gap-1 mb-2">
          {past14Days.map((date) => {
            const hasRecord =
              allRecords[date] &&
              allRecords[date].some((text) => text.trim() !== "");
            const isSelected = selectedDate === date; // 🔴 今選ばれている日付かどうか

            return (
              <button
                key={date}
                title={date}
                onClick={() => {
                  // 🔴 緑のマス（記録あり）をタップしたら、その日付をセットする
                  if (hasRecord) {
                    setSelectedDate(isSelected ? null : date); // もう一度押したら閉じる
                  }
                }}
                className={`w-4 h-4 rounded-[4px] transition-all ${
                  hasRecord
                    ? "bg-green-400 hover:bg-green-500 cursor-pointer shadow-sm"
                    : "bg-gray-100 cursor-default"
                } ${isSelected ? "ring-2 ring-pink-400 ring-offset-1 scale-110" : ""}`} // 選ばれているマスは少し目立たせる
              />
            );
          })}
        </div>

        {/* 🔴 新規追加：選んだ日付の記録をフワッと表示するエリア */}
        <AnimatePresence>
          {selectedDate && allRecords[selectedDate] && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full mt-2 bg-white/80 rounded-lg p-3 text-left shadow-sm border border-pink-100 overflow-hidden"
            >
              <p className="text-[0.7rem] font-bold text-pink-500 mb-2 border-b border-pink-100 pb-1">
                📅 {selectedDate} のよかったこと
              </p>
              <ul className="flex flex-col gap-1">
                {allRecords[selectedDate].map(
                  (text, i) =>
                    text.trim() !== "" && (
                      <li key={i} className="text-sm text-gray-600 flex gap-2">
                        <span className="text-pink-300 font-bold">
                          {i + 1}.
                        </span>
                        {text}
                      </li>
                    ),
                )}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
