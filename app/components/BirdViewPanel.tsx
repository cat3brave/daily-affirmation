"use client";

import { AnimatePresence, motion } from "framer-motion";

type BirdViewPanelProps = {
  currentTab: "home" | "work" | "amulet";
  isBirdView: boolean;
  totalBlooms: number;
};

export default function BirdViewPanel({
  currentTab,
  isBirdView,
  totalBlooms,
}: BirdViewPanelProps) {
  return (
    <AnimatePresence>
      {currentTab === "home" && isBirdView && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute top-24 z-40 flex flex-col items-center"
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

            <div className="bg-pink-50 rounded-2xl p-4 inline-block border border-pink-100">
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
  );
}
