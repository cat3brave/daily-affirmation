"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const affirmations = [
  "今の自分でOK!",
  "短所も欠点も自分の大切な個性",
  "心の揺れは成長のチャンス",
  "失敗は成長の機会",
  "自分を大切にすることは、他人を大切にすること",
  "それでいい、今の自分でOK!",
  "自分を責めるのは古傷が傷んでいるから。つらかったね。でも今はもう安心!",
  "自分の決断で他者を傷つける結果になることもある。それが生きること。自分の軸に従って自分の気持ちを表明できたことが素晴らしい!",
];

export default function Home() {
  const [text, setText] = useState<string>("");

  const handleClick = () => {
    let newText = text;
    // 前回と違う言葉が出るまで抽選をやり直す（UX向上：必ずアニメーションさせるため）
    // ※リストが1個しかない場合は無限ループになるので注意（今回は8個あるのでOK）
    while (newText === text) {
      const randomIndex = Math.floor(Math.random() * affirmations.length);
      newText = affirmations[randomIndex];
    }
    setText(newText);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      {/* 肯定文の表示エリア */}
      <div className="h-60 flex items-center justify-center mb-8 w-full max-w-lg">
        {/* 高さを少し広げ(h-60)、横幅制限(max-w-lg)で長い文章でも読みやすくしました */}
        <AnimatePresence mode="wait">
          {text && (
            <motion.p
              key={text}
              initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(10px)" }}
              transition={{ duration: 0.8, ease: "easeOut" }} // 少しテンポよく0.8秒に
              className="text-xl md:text-2xl text-gray-600 font-medium text-center leading-loose tracking-widest"
            >
              {text}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <motion.button
        whileHover={{
          scale: 1.05,
          boxShadow: "0px 5px 15px rgba(0, 0, 0, 0.1)",
        }}
        whileTap={{ scale: 0.95 }}
        onClick={handleClick}
        className="px-8 py-4 bg-white text-gray-500 rounded-full shadow-sm transition-colors duration-300 text-lg tracking-[0.2em] border border-gray-100 hover:bg-gray-50"
      >
        言葉を受け取る
      </motion.button>
    </main>
  );
}
