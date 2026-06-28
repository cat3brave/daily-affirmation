import { motion } from "framer-motion";
import AffirmationSection from "./AffirmationSection";

const flowerStages = ["🌰", "🌱", "🌿", "🌷", "🌸"];
const growthMessages = [
  "種を植えました。お散歩して育てよう！",
  "芽が出ました！その調子！",
  "葉っぱが育っています。いいペースですね！",
  "つぼみがつきました！あともう少し！",
  "満開のお花が咲きました！今日も素晴らしい一日です！",
];

// 親（page.tsx）から受け取るデータの型を定義します
type HomeTabProps = {
  isLoading: boolean;
  text: string;
  handleClick: () => void;
  handleFavoriteAffirmation: () => void;
  handleRemoveFavoriteAffirmation: (affirmation: string) => void;
  isFavoriteDisabled: boolean;
  favoriteAffirmations: string[];
  totalBlooms: number;
  growth: number;
  currentFlower: string;
  isBloomSaving: boolean;
  handleWalk: () => void | Promise<void>;
  setShowTada: (value: boolean) => void;
};

export default function HomeTab({
  isLoading,
  text,
  handleClick,
  handleFavoriteAffirmation,
  handleRemoveFavoriteAffirmation,
  isFavoriteDisabled,
  favoriteAffirmations,
  totalBlooms,
  growth,
  currentFlower,
  isBloomSaving,
  handleWalk,
  setShowTada,
}: HomeTabProps) {
  return (
    <div className="w-full flex flex-col items-center">
      <AffirmationSection
        isLoading={isLoading}
        text={text}
        handleClick={handleClick}
        handleFavoriteAffirmation={handleFavoriteAffirmation}
        isFavoriteDisabled={isFavoriteDisabled}
      />

      {/* 3. お気に入りアファメーション一覧 */}
      {favoriteAffirmations.length > 0 && (
        <div className="mb-10 w-full max-w-md bg-white/50 backdrop-blur-sm p-5 rounded-3xl border border-pink-100 shadow-sm">
          <p className="text-pink-500 font-bold mb-3 text-center tracking-wide">
            🌷 お気に入りの言葉
          </p>

          <ul className="space-y-2">
            {favoriteAffirmations.map((affirmation, index) => (
              <li
                key={`${affirmation}-${index}`}
                className="bg-white/80 border border-pink-100 rounded-2xl px-4 py-3 text-sm text-pink-700 leading-relaxed flex items-start justify-between gap-3"
              >
                <span className="flex-1">{affirmation}</span>

                <button
                  type="button"
                  onClick={() => handleRemoveFavoriteAffirmation(affirmation)}
                  className="shrink-0 text-xs text-pink-400 hover:text-pink-600 font-bold"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 4. デジタル花壇エリア */}
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

      {/* 5. 失敗の告白ボタン */}
      <div className="mt-8 mb-4">
        <button
          onClick={() => setShowTada(true)}
          className="text-sm text-sky-500/60 hover:text-sky-500 transition-colors decoration-sky-300/50 underline underline-offset-4"
        >
          今日、ちょっと失敗しちゃった...
        </button>
      </div>
    </div>
  );
}
