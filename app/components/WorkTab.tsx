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
  translationEnabled: boolean;
};

export default function WorkTab({ handleFloatCloud, onGoodThingsReady, translationEnabled }: WorkTabProps) {
  const breathingHeadingRef = useRef<HTMLHeadingElement>(null);
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
      <a
        href="#breathing-guide"
        onClick={(event) => {
          const heading = breathingHeadingRef.current;
          if (!heading) return;
          event.preventDefault();
          heading.focus({ preventScroll: true });
          heading.scrollIntoView({ block: "start", behavior: reduceMotion ? "instant" : "smooth" });
        }}
        className="self-start mb-6 px-4 py-3 rounded-full bg-sky-50 text-sky-800 font-bold underline underline-offset-4 hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-sky-800 focus-visible:outline-offset-4"
      >
        深呼吸ガイドへ
      </a>
      {/* 5つのカードを並べるだけ！（順番もここで自由に入れ替えられます） */}
      <GentleTranslatorCard translationEnabled={translationEnabled} />
      <AndBalanceCard />
      <MaybeCloudCard handleFloatCloud={handleFloatCloud} />
      <SixtyScoreCard />
      <BreathingCard headingRef={breathingHeadingRef} />
      <ThreeGoodThingsCard headingRef={headingRef} />
    </motion.div>
  );
}
