"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { FloatingCloud } from "../hooks/useFloatingClouds";

type FloatingCloudLayerProps = {
  floatingClouds: FloatingCloud[];
};

export default function FloatingCloudLayer({
  floatingClouds,
}: FloatingCloudLayerProps) {
  return (
    <>
      <AnimatePresence>
        {floatingClouds.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="pointer-events-none fixed inset-0 z-[15] bg-sky-50/20 backdrop-blur-md"
          />
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden flex justify-center items-end pb-40">
        <AnimatePresence>
          {floatingClouds.map((cloud) => (
            <motion.div
              key={cloud.id}
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: cloud.y,
                x: cloud.x,
                scale: 1.1,
              }}
              transition={{ duration: 8, ease: "easeInOut" }}
              className="absolute bg-white px-8 py-5 rounded-[3rem] shadow-xl border-2 border-sky-100 text-sky-900 font-bold text-lg tracking-wide"
            >
              「{cloud.text}」
              <span className="text-sky-500 font-black ml-1">……かも？ ☁️</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
