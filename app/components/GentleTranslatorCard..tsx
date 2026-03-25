import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { translateHarshVoice } from "../actions";

export default function GentleTranslatorCard() {
  const [harshVoice, setHarshVoice] = useState("");
  const [translatedVoice, setTranslatedVoice] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);

  const handleTranslate = async () => {
    if (!harshVoice.trim() || isTranslating) return;
    setIsTranslating(true);
    setTranslatedVoice("");
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
  );
}
