import { motion } from "framer-motion";

type AmuletTabProps = {
  setShowTada: (value: boolean) => void;
};

export default function AmuletTab({ setShowTada }: AmuletTabProps) {
  return (
    <motion.div
      key="amulet"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full flex flex-col items-center"
    >
      <div className="w-full max-w-md bg-white/60 backdrop-blur-md p-10 rounded-[3rem] border-2 border-white shadow-sm flex flex-col items-center mt-10 text-center">
        <div className="text-5xl mb-4">🩹</div>
        <h3 className="text-sky-800 font-bold text-xl mb-4 tracking-wider">
          失敗の救急箱
        </h3>
        <p className="text-sky-700/80 text-sm leading-relaxed mb-8">
          完璧じゃなくても大丈夫。
          <br />
          失敗は「挑戦した証拠」です。
          <br />
          今日はうまくできなかったなと思ったら、
          <br />
          下のボタンを押してみてください。
        </p>
        <button
          onClick={() => setShowTada(true)}
          className="px-8 py-4 bg-yellow-400 text-white rounded-full shadow-md hover:bg-yellow-500 transition-colors duration-300 text-lg font-bold tracking-widest border-4 border-yellow-300"
        >
          今日、失敗しちゃった！
        </button>
      </div>
    </motion.div>
  );
}
