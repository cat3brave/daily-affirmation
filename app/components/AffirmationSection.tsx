import type { AffirmationResultStatus } from "../actions";
import { motion } from "framer-motion";

type AffirmationSectionProps = {
  affirmationEnabled: boolean;
  isLoading: boolean;
  text: string;
  resultStatus: AffirmationResultStatus | null;
  authError: string;
  rateLimitError: string;
  timeoutError?: string;
  usageError?: string;
  handleClick: () => void;
  handleFavoriteAffirmation: () => void;
  isFavoriteDisabled: boolean;
};

export default function AffirmationSection({
  affirmationEnabled,
  isLoading,
  text,
  resultStatus,
  authError,
  rateLimitError,
  timeoutError,
  usageError,
  handleClick,
  handleFavoriteAffirmation,
  isFavoriteDisabled,
}: AffirmationSectionProps) {
  const buttonLabel = affirmationEnabled ? "言葉を受け取る" : "用意した言葉を受け取る";

  return (
    <>
      {/* 1. 肯定文の表示エリア */}
      <div className="min-h-64 h-auto flex items-center justify-center mb-6 w-full max-w-lg bg-white/60 backdrop-blur-md rounded-[3rem] px-2 py-4 sm:p-8 shadow-sm border-2 border-white">
        {isLoading ? (
          <p
            role="status"
            aria-atomic="true"
            className="text-lg text-blue-400/70 animate-pulse tracking-widest"
          >
            {affirmationEnabled ? "言葉を紡いでいます..." : "用意した言葉を表示しています…"}
          </p>
        ) : authError ? (
          <div
            role="alert"
            className="text-center text-red-700 text-sm leading-relaxed"
          >
            <p>{authError}</p>
            <a className="font-bold underline underline-offset-4" href="/login">
              ログイン画面へ
            </a>
          </div>
        ) : usageError || rateLimitError ? (
          <p
            role="alert"
            className="text-center text-red-700 text-sm leading-relaxed"
          >
            {usageError || rateLimitError}
          </p>
        ) : text ? (
          <motion.div
            key={text}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex min-w-0 flex-col items-center gap-4 break-words"
          >
            {timeoutError && (
              <p
                role="alert"
                className="text-center text-red-700 text-sm leading-relaxed"
              >
                {timeoutError}
              </p>
            )}
            <div role="status" aria-atomic="true" className="text-center text-blue-800/80">
              <p className="mb-2 text-xs font-bold leading-relaxed">
                {resultStatus === "success" ? "AIによる提案（見方の一例）" : "用意した言葉"}
              </p>
              {resultStatus === "fallback" && (
                <p className="mb-2 text-xs leading-relaxed">
                  {affirmationEnabled && "AIの応答を取得できなかったため、用意した言葉を表示しています。"}
                  「{buttonLabel}」から、もう一度試せます。
                </p>
              )}
              <p className="text-xl font-medium leading-loose tracking-widest md:text-2xl">{text}</p>
            </div>

            <button
              type="button"
              onClick={handleFavoriteAffirmation}
              disabled={isFavoriteDisabled}
              className="max-w-full px-3 sm:px-5 py-2 rounded-full bg-pink-100 text-pink-500 text-sm font-bold border border-pink-200 hover:bg-pink-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isFavoriteDisabled
                ? "お気に入り済み 🌸"
                : "お気に入りにする 🌷"}
            </button>
          </motion.div>
        ) : (
          <p
            role="status"
            aria-atomic="true"
            className="text-blue-400/70 text-lg"
          >
            ボタンを押して、言葉を受け取ってください
          </p>
        )}
      </div>

      {/* 2. アファメーションを受け取るボタン */}
      <div className="mb-10 w-full flex flex-col items-center">
        <p
          id="affirmation-ai-guidance"
          className="mb-3 text-center text-xs text-sky-700/60"
        >
          {affirmationEnabled
            ? "この機能は外部AI（Google Gemini）を利用します。"
            : "現在は、お守り言葉をもとに用意した言葉を表示します。"}
        </p>
        <motion.button
          type="button"
          whileHover={{
            scale: isLoading ? 1 : 1.05,
            backgroundColor: isLoading ? "#0369a1" : "#0284c7",
            boxShadow: isLoading
              ? "none"
              : "0px 10px 25px rgba(14, 165, 233, 0.4)",
          }}
          whileTap={{ scale: isLoading ? 1 : 0.95 }}
          onClick={() => {
            if (!isLoading) handleClick();
          }}
          aria-disabled={isLoading}
          aria-describedby="affirmation-ai-guidance"
          className={`max-w-full px-6 sm:px-12 py-5 bg-sky-700 text-white rounded-full shadow-md transition-colors duration-300 text-lg font-bold tracking-widest border-4 border-sky-700 ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
        >
          {isLoading ? (affirmationEnabled ? "受け取り中..." : "表示中…") : buttonLabel}
        </motion.button>
      </div>
    </>
  );
}
