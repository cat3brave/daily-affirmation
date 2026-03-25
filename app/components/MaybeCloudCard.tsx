import { useState } from "react";

type Props = {
  handleFloatCloud: (text: string) => void;
};

export default function MaybeCloudCard({ handleFloatCloud }: Props) {
  const [maybeInput, setMaybeInput] = useState("");

  const onReleaseCloud = () => {
    if (!maybeInput.trim()) return;
    handleFloatCloud(maybeInput);
    setMaybeInput("");
  };

  return (
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
          onKeyDown={(e) => e.key === "Enter" && onReleaseCloud()}
          placeholder="例: 絶対に嫌われた..."
          className="flex-1 px-4 py-3 rounded-2xl border border-sky-200 focus:outline-none focus:ring-2 focus:ring-sky-400 bg-white/80 text-sky-800 text-sm shadow-inner"
        />
        <button
          onClick={onReleaseCloud}
          disabled={!maybeInput.trim()}
          className="px-5 py-3 bg-sky-400 hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold transition-colors shadow-sm whitespace-nowrap"
        >
          放つ
        </button>
      </div>
    </div>
  );
}
