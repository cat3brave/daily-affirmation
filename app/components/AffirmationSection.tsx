import { motion, AnimatePresence } from "framer-motion";

type AffirmationSectionProps = {
  isLoading: boolean;
  text: string;
  handleClick: () => void;
  handleFavoriteAffirmation: () => void;
  isFavoriteDisabled: boolean;
};

export default function AffirmationSection({
  isLoading,
  text,
  handleClick,
  handleFavoriteAffirmation,
  isFavoriteDisabled,
}: AffirmationSectionProps) {
  return (
    <>
      {/* 1. 肯定文の表示エリア */}
      <div className="h-64 flex items-center justify-center mb-6 w-full max-w-lg bg-white/60 backdrop-blur-md rounded-[3rem] p-8 shadow-sm border-2 border-white">
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
            <motion.div
              key={text}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="flex flex-col items-center gap-4"
            >
              <p className="text-xl md:text-2xl text-blue-800/80 font-medium text-center leading-loose tracking-widest">
                {text}
              </p>

              <button
                onClick={handleFavoriteAffirmation}
                disabled={isFavoriteDisabled}
                className="px-5 py-2 rounded-full bg-pink-100 text-pink-500 text-sm font-bold border border-pink-200 hover:bg-pink-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isFavoriteDisabled
                  ? "お気に入り済み 🌸"
                  : "お気に入りにする 🌷"}
              </button>
            </motion.div>
          ) : (
            <p className="text-blue-400/70 text-lg">
              ボタンを押して、言葉を受け取ってください
            </p>
          )}
        </AnimatePresence>
      </div>

      {/* 2. アファメーションを受け取るボタン */}
      <div className="mb-10 w-full flex justify-center">
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
          className={`px-12 py-5 bg-sky-500 text-white rounded-full shadow-md transition-colors duration-300 text-lg font-bold tracking-widest border-4 border-sky-500 ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
        >
          {isLoading ? "受け取り中..." : "言葉を受け取る"}
        </motion.button>
      </div>
    </>
  );
}
