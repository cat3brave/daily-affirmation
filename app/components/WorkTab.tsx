import { motion } from "framer-motion";
import GentleTranslatorCard from "./GentleTranslatorCard.";
import AndBalanceCard from "./AndBalanceCard";
import MaybeCloudCard from "./MaybeCloudCard";
import SixtyScoreCard from "./SixtyScoreCard";

type WorkTabProps = {
  handleFloatCloud: (text: string) => void;
};

export default function WorkTab({ handleFloatCloud }: WorkTabProps) {
  return (
    <motion.div
      key="work"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full flex flex-col items-center mt-4"
    >
      {/* 4つのカードを並べるだけ！（順番もここで自由に入れ替えられます） */}
      <GentleTranslatorCard />
      <AndBalanceCard />
      <MaybeCloudCard handleFloatCloud={handleFloatCloud} />
      <SixtyScoreCard />
    </motion.div>
  );
}
