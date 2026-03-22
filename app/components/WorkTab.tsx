import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
// 🔴 さっき actions.ts に作った関数を読み込みます！
import { translateHarshVoice } from "../actions";

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
  // ⚖️ 天秤用のステート
  const [leftFact, setLeftFact] = useState("");
  const [rightFact, setRightFact] = useState("");
  const [isBalanced, setIsBalanced] = useState(false);

  // 🕊️ 翻訳機用のステート（新規追加！）
  const [harshVoice, setHarshVoice] = useState("");
  const [translatedVoice, setTranslatedVoice] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

  const handleBalance = () => {
    if (leftFact.trim() && rightFact.trim()) {
      setIsBalanced(true);
    }
  };

  // 🕊️ 翻訳ボタンを押したときの処理
  const handleTranslate = async () => {
    if (!harshVoice.trim() || isTranslating) return;
    setIsTranslating(true);
    setTranslatedVoice(""); // 前の結果を消す
    try {
      const result = await translateHarshVoice(harshVoice);
      setTranslatedVoice(result);
    } catch (error) {
      setTranslatedVoice(
        "エラーが発生しました。少し休んでからもう一度試してみてくださいね。",
      );
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <motion.div
      key="work"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full flex flex-col items-center mt-4"
    >
      {/* 🗣️➡️🕊️ 1. 優しい翻訳機（新規追加！） */}
      <div className="w-full max-w-md bg-white/60 backdrop-blur-md p-6 rounded-[2rem] border-2 border-white shadow-sm mb-8 flex flex-col items-center">
        <p className="text-sky-800/80 font-bold mb-2 tracking-wide text-center">
          🗣️➡️🕊️ 優しい翻訳機
        </p>
        <p className="text-sky-700/60 text-xs mb-4 text-center leading-relaxed">
          自分を責める厳しい声を、AIが「思いやりのある大人」の視点で
          <br />
          客観的な事実と労わりの言葉に翻訳します。
        </p>

        <textarea
          value={harshVoice}
          onChange={(e) => setHarshVoice(e.target.value)}
          placeholder="例: 私って本当にダメな人間だ。いつも失敗ばかりして迷惑をかけている..."
          className="w-full px-4 py-4 rounded-2xl border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white/80 text-sky-800 text-sm shadow-inner resize-none h-28 mb-4 leading-relaxed"
        />

        <button
          onClick={handleTranslate}
          disabled={!harshVoice.trim() || isTranslating}
          className="px-6 py-4 bg-sky-400 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold transition-colors shadow-sm w-full mb-4 tracking-widest"
        >
          {isTranslating ? "翻訳中..." : "優しい言葉に翻訳する 🪄"}
        </button>

        <AnimatePresence mode="wait">
          {translatedVoice && (
            <motion.div
              initial={{ opacity: 0, y: 10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              className="bg-blue-50 border border-blue-200 text-blue-800 px-5 py-5 rounded-2xl text-sm leading-loose w-full shadow-sm"
            >
              <span className="font-bold text-blue-500 block mb-2 tracking-wide">
                🕊️ 翻訳結果：
              </span>
              {translatedVoice}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ⚖️ 2. 「そして」の天秤 */}
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

      {/* ☁️ 3. 断定（決めつけ）を空に放つ */}
      <div className="w-full max-w-md bg-white/60 backdrop-blur-md p-6 rounded-[2rem] border-2 border-white shadow-sm mb-8 flex flex-col items-center">
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

      {/* 4. 完璧主義ストッパー（60点スライダー） */}
      <div className="w-full max-w-md bg-white/60 backdrop-blur-md p-6 rounded-[2rem] border-2 border-white shadow-sm flex flex-col items-center">
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
