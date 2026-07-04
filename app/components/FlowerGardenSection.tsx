import { motion } from "framer-motion";

const flowerStages = ["🌰", "🌱", "🌿", "🌷", "🌸"];
const growthMessages = [
  "種を植えました。お散歩して育てよう！",
  "芽が出ました！その調子！",
  "葉っぱが育っています。いいペースですね！",
  "つぼみがつきました！あともう少し！",
  "満開のお花が咲きました！今日も素晴らしい一日です！",
];

type FlowerGardenSectionProps = {
  totalBlooms: number;
  growth: number;
  currentFlower: string;
  isBloomSaving: boolean;
  flowerError: string;
  handleWalk: () => void | Promise<void>;
};

export default function FlowerGardenSection({
  totalBlooms,
  growth,
  currentFlower,
  isBloomSaving,
  flowerError,
  handleWalk,
}: FlowerGardenSectionProps) {
  return (
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
      <motion.div
        key={growth}
        initial={{ scale: 0.5, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="text-7xl my-4"
      >
        {growth === flowerStages.length - 1
          ? currentFlower
          : flowerStages[growth]}
      </motion.div>
      <p className="text-sky-800/80 text-sm font-medium mb-6 text-center h-5">
        {growthMessages[growth]}
      </p>
      {flowerError && (
        <p
          role="alert"
          className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-center text-sm font-medium leading-relaxed text-rose-600"
        >
          {flowerError}
        </p>
      )}
      <motion.button
        whileHover={{
          scale: isBloomSaving ? 1 : 1.05,
          backgroundColor: isBloomSaving ? "#ffffff" : "#f0fbf4",
        }}
        whileTap={{ scale: isBloomSaving ? 1 : 0.95 }}
        onClick={handleWalk}
        disabled={isBloomSaving}
        className="px-8 py-3 bg-white text-green-600 rounded-full shadow-sm transition-colors duration-300 text-base font-bold tracking-widest border-2 border-green-200 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isBloomSaving
          ? "お花を記録中... 🌸"
          : growth >= flowerStages.length - 1
            ? "新しい種を植える 🌱"
            : "今日もお散歩した！ 💧"}
      </motion.button>
    </div>
  );
}
