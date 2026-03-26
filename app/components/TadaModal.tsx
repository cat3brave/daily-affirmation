import { motion, AnimatePresence } from "framer-motion";
import Confetti from "react-confetti";

type TadaModalProps = {
  showTada: boolean;
  setShowTada: (show: boolean) => void;
  windowSize: { width: number; height: number };
};

export default function TadaModal({
  showTada,
  setShowTada,
  windowSize,
}: TadaModalProps) {
  return (
    <>
      {/* 🎊 紙吹雪 */}
      {showTada && (
        <Confetti
          style={{ zIndex: 150 }}
          width={windowSize.width}
          height={windowSize.height}
          numberOfPieces={300}
          recycle={false}
          gravity={0.15}
          colors={[
            "#FFB6C1",
            "#87CEFA",
            "#FFFFE0",
            "#98FB98",
            "#BBB",
            "#FFD700",
          ]}
        />
      )}

      {/* 🎪 くす玉モーダル本体 */}
      <AnimatePresence>
        {showTada && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-sky-900/40 backdrop-blur-sm p-4"
            onClick={() => setShowTada(false)}
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -10, y: 50 }}
              animate={{ scale: 1, rotate: 0, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: "spring", bounce: 0.6, duration: 0.8 }}
              className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl border-4 border-yellow-300 text-center max-w-md w-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1 }}
                className="text-7xl mb-6"
              >
                🎉
              </motion.div>
              <h2 className="text-4xl font-black text-yellow-500 mb-4 tracking-widest drop-shadow-sm">
                Ta-Da!
              </h2>
              <p className="text-sky-800 font-extrabold text-xl mb-3">
                ナイストライ！👏
              </p>
              <p className="text-sky-700/80 text-base leading-relaxed mb-8 font-medium">
                失敗は「挑戦した証拠」であり、
                <br />
                とても貴重なデータです。
                <br />
                完璧じゃないあなたも、最高に素晴らしい!
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowTada(false)}
                className="bg-yellow-400 text-white font-bold py-4 px-10 rounded-full shadow-md hover:bg-yellow-500 transition-colors text-lg tracking-wider"
              >
                ありがとう!🌟
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
