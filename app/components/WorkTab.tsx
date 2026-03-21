import { motion, AnimatePresence } from "framer-motion";

type WorkTabProps = {
  maybeInput: string;
  setMaybeInput: (value: string) => void;
  handleFloatCloud: () => void;
  targetScore: number;
  setTargetScore: (value: number) => void;
};

export default function WorkTab({
  maybeInput,
  setMaybeInput,
  handleFloatCloud,
  targetScore,
  setTargetScore,
}: WorkTabProps) {
  return (
    <motion.div
      key="work"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full flex flex-col items-center"
    >
      {/* ☁️ 断定（決めつけ）を空に放つ */}
      <div className="w-full max-w-md bg-white/60 backdrop-blur-md p-6 rounded-[2rem] border-2 border-white shadow-sm mb-8 flex flex-col items-center mt-4">
        <p className="text-sky-800/80 font-bold mb-2 tracking-wide text-center">
          ☁️ 断定（決めつけ）を空に放つ ☁️
        </p>
        <p className="text-sky-700/60 text-xs mb-4 text-center">
          「絶対～だ」という考えを書いて、空に浮かべてみましょう
        </p>
        <div className="flex w-full gap-2">
          <input
            type="text"
            value={maybeInput}
            onChange={(e) => setMaybeInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFloatCloud()}
            placeholder="例: 絶対に嫌われた..."
            className="flex-1 px-4 py-3 rounded-2xl border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white/80 text-sky-800 text-sm shadow-inner"
          />
          <button
            onClick={handleFloatCloud}
            disabled={!maybeInput.trim()}
            className="px-5 py-3 bg-sky-400 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold transition-colors shadow-sm whitespace-nowrap"
          >
            放つ
          </button>
        </div>
      </div>

      {/* 今日の目標ライン（60点スライダー） */}
      <div className="w-full max-w-md bg-white/60 backdrop-blur-md p-6 rounded-[2rem] border-2 border-white shadow-sm mb-8 flex flex-col items-center">
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
    </motion.div>
  );
}
