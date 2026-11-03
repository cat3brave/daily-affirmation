import { useEffect, useRef } from "react";
import { motion, useIsPresent, useReducedMotion } from "framer-motion";
import GentleTranslatorCard from "./GentleTranslatorCard";
import AndBalanceCard from "./AndBalanceCard";
import MaybeCloudCard from "./MaybeCloudCard";
import SixtyScoreCard from "./SixtyScoreCard";
import BreathingCard from "./BreathingCard";
import ThreeGoodThingsCard from "./ThreeGoodThingsCard";

type WorkTabProps = {
  onGoodThingsReady?: (heading: HTMLHeadingElement) => void;
  handleFloatCloud: (text: string) => void;
};

export default function WorkTab({ handleFloatCloud, onGoodThingsReady }: WorkTabProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reduceMotion = useReducedMotion();
  const isPresent = useIsPresent();
  const notifyReady = () => {
    if (isPresent && headingRef.current) onGoodThingsReady?.(headingRef.current);
  };

  // 動きを減らす場合は入場アニメーションを待たず、描画後に知らせます。
  useEffect(() => {
    if (reduceMotion && isPresent && headingRef.current) {
      onGoodThingsReady?.(headingRef.current);
    }
  }, [reduceMotion, isPresent, onGoodThingsReady]);
  return (
    <motion.div
      aria-label="心を整えるワーク"
      role="region"
      key="work"
      initial={reduceMotion ? false : { opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduceMotion ? { opacity: 1 } : { opacity: 0, x: -20 }}
      onAnimationComplete={notifyReady}
      className="w-full flex flex-col items-center mt-4"
    >
      {/* 5つのカードを並べるだけ！（順番もここで自由に入れ替えられます） */}
      <GentleTranslatorCard />
      <AndBalanceCard />
      <MaybeCloudCard handleFloatCloud={handleFloatCloud} />
      <SixtyScoreCard />
      <BreathingCard />
      <ThreeGoodThingsCard headingRef={headingRef} />
    </motion.div>
  );
}
