import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AndBalanceCard() {
  const [leftFact, setLeftFact] = useState("");
  const [rightFact, setRightFact] = useState("");
  const [isBalanced, setIsBalanced] = useState(false);

  const handleBalance = () => {
    if (leftFact.trim() && rightFact.trim()) {
      setIsBalanced(true);
    }
  };

  return (
    <div className="w-full max-w-md bg-white/60 backdrop-blur-md p-6 rounded-[2rem] border-2 border-white shadow-sm mb-8 flex flex-col items-center">
      <p className="text-sky-800/80 font-bold mb-2 tracking-wide text-center">
        ⚖️ 「そして」の天秤
      </p>
      <p className="text-sky-700/60 text-xs mb-6 text-center leading-relaxed">
        極端な思考を無理に消さなくて大丈夫です。
        <br />
        「そして」と、もう一つの小さな事実を足してみましょう。
      </p>
      <div className="w-full flex flex-col gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-sky-700 ml-2">
            起きた事実・ネガティブな思考
          </label>
          <input
            type="text"
            value={leftFact}
            onChange={(e) => {
              setLeftFact(e.target.value);
              setIsBalanced(false);
            }}
            placeholder="例: 今日は何もできなかった..."
            className="w-full px-4 py-3 rounded-2xl border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white/80 text-sky-800 text-sm shadow-inner"
          />
        </div>
        <div className="flex justify-center my-1">
          <span className="text-sky-400 font-black text-sm tracking-widest">
            ＋ そして（AND）
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-bold text-sky-700 ml-2">
            並列する、もう一つの事実
          </label>
          <input
            type="text"
            value={rightFact}
            onChange={(e) => {
              setRightFact(e.target.value);
              setIsBalanced(false);
            }}
            placeholder="例: でも、温かいお茶は飲めた"
            className="w-full px-4 py-3 rounded-2xl border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white/80 text-sky-800 text-sm shadow-inner"
          />
        </div>
      </div>
      <motion.div
        animate={{
          rotate: isBalanced ? 0 : leftFact && !rightFact ? -15 : 0,
          scale: isBalanced ? 1.2 : 1,
        }}
        transition={{ type: "spring", stiffness: 100, bounce: 0.5 }}
        className="text-5xl mb-6"
      >
        ⚖️
      </motion.div>
      <button
        onClick={handleBalance}
        disabled={!leftFact.trim() || !rightFact.trim() || isBalanced}
        className="px-6 py-4 bg-sky-400 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold transition-colors shadow-sm w-full mb-2 tracking-widest"
      >
        天秤でバランスを取る
      </button>
      <AnimatePresence>
        {isBalanced && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            className="mt-4 bg-green-50 border border-green-200 text-green-700 px-4 py-4 rounded-xl text-sm font-bold w-full text-center shadow-sm leading-relaxed"
          >
            🌿 どちらも、あなたの大切な真実ですね。
            <br />
            <span className="text-green-600/80 font-medium text-xs mt-1 block">
              世界は少しだけ、広く見えていますか？
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
