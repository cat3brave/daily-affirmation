"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { generateAffirmation } from "./actions";
import Confetti from "react-confetti";

import HomeTab from "./components/HomeTab";
import WorkTab from "./components/WorkTab";
import AmuletTab from "./components/AmuletTab";

export default function Home() {
  const [text, setText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [growth, setGrowth] = useState<number>(0);
  const [totalBlooms, setTotalBlooms] = useState<number>(0);
  const [isBirdView, setIsBirdView] = useState<boolean>(false);
  const [showTada, setShowTada] = useState<boolean>(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [currentFlower, setCurrentFlower] = useState<string>("🌸");
  const [currentTab, setCurrentTab] = useState<"home" | "work" | "amulet">(
    "home",
  );

  // 雲の座標情報を保持して、レンダリングごとのチラつきを防ぐ
  const [floatingClouds, setFloatingClouds] = useState<
    { id: number; text: string; x: number; y: number }[]
  >([]);

  useEffect(() => {
    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const storedGrowth = localStorage.getItem("flowerGrowth");
    if (storedGrowth) setGrowth(parseInt(storedGrowth, 10));
    const storedTotal = localStorage.getItem("totalBlooms");
    if (storedTotal) setTotalBlooms(parseInt(storedTotal, 10));
    const storedFlower = localStorage.getItem("currentFlower");
    if (storedFlower) setCurrentFlower(storedFlower);
  }, []);

  const handleClick = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setText("");
    try {
      const newText = await generateAffirmation();
      setText(newText);
    } catch (error) {
      setText("深呼吸して、もう一度試してみてくださいね。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleWalk = () => {
    const flowerStages = ["🌰", "🌱", "🌿", "🌷", "🌸"];
    let nextGrowth = 0;
    if (growth >= flowerStages.length - 1) {
      nextGrowth = 0;
      const newTotal = totalBlooms + 1;
      setTotalBlooms(newTotal);
      localStorage.setItem("totalBlooms", newTotal.toString());
    } else {
      nextGrowth = growth + 1;
      if (nextGrowth === flowerStages.length - 1) {
        const rand = Math.random();
        let nextFlower = "🌸";
        if (rand > 0.7) {
          const rareFlowers = ["🌺", "🌻", "🌼", "🍀", "🌹", "🍄"];
          nextFlower =
            rareFlowers[Math.floor(Math.random() * rareFlowers.length)];
        }
        setCurrentFlower(nextFlower);
        localStorage.setItem("currentFlower", nextFlower);
      }
    }
    setGrowth(nextGrowth);
    localStorage.setItem("flowerGrowth", nextGrowth.toString());
  };

  const handleFloatCloud = (cloudText: string) => {
    const newCloud = {
      id: Date.now(),
      text: cloudText,
      x: (Math.random() - 0.5) * 100, // 生成時に乱数を固定
      y: -300 - Math.random() * 100, // 生成時に乱数を固定
    };
    setFloatingClouds((prev) => [...prev, newCloud]);

    setTimeout(() => {
      setFloatingClouds((prev) => prev.filter((c) => c.id !== newCloud.id));
    }, 8000);
  };

  return (
    <main
      className={`relative flex min-h-screen flex-col items-center p-6 pb-32 overflow-hidden transition-colors duration-1000 ${isBirdView ? "bg-sky-100" : "bg-transparent"}`}
    >
      {showTada && (
        <Confetti
          style={{ zIndex: 150 }}
          width={windowSize.width}
          height={windowSize.height}
          numberOfPieces={300}
          recycle={false}
          gravity={0.15}
          colors={[
            "#FFB6C1",
            "#87CEFA",
            "#FFFFE0",
            "#98FB98",
            "#BBB",
            "#FFD700",
          ]}
        />
      )}

      {/* ☁️ 雲が飛んでいる間、うしろをフワッとぼやかすカーテン（マインドフルネス効果） */}
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

      {/* かも雲のアニメーション（z-20にして、ぼかしカーテンの手前を飛ぶように設定！） */}
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

      <button
        onClick={() => setIsBirdView(!isBirdView)}
        className="absolute top-6 left-6 z-50 bg-white/80 backdrop-blur-sm hover:bg-white text-sky-600 px-4 py-2 rounded-full shadow-sm border border-sky-100 font-bold tracking-wide transition-all"
      >
        {isBirdView ? "🌱 地上に戻る" : "🕊️ 鳥の目線になる"}
      </button>

      <AnimatePresence>
        {isBirdView && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="absolute top-24 z-40 flex flex-col items-center"
          >
            <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-lg border border-sky-100 text-center max-w-sm">
              <p className="text-sky-800 font-bold mb-3">🕊️ 空からの景色</p>
              <p className="text-sky-700/80 text-sm leading-relaxed mb-4">
                少し離れて、深呼吸してみましょう。
                <br />
                目の前の小さなことは一旦置いておいて大丈夫。
                <br />
                あなたは今日まで、こんなに素敵な軌跡を描いています。
              </p>
              <div className="bg-pink-50 rounded-2xl p-4 inline-block border border-pink-100">
                <p className="text-xs text-pink-400 font-bold mb-1">
                  今までに咲かせたお花
                </p>
                <p className="text-3xl text-pink-500 font-bold tracking-widest">
                  🌸 {totalBlooms} <span className="text-lg">個 </span>
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={{
          scale: isBirdView ? 0.75 : 1,
          opacity: isBirdView ? 0.3 : 1,
          y: isBirdView ? 120 : 0,
        }}
        transition={{ duration: 1, ease: "easeInOut" }}
        className="w-full max-w-lg flex flex-col items-center z-10 origin-bottom mt-16"
      >
        <AnimatePresence mode="wait">
          {currentTab === "home" && (
            <HomeTab
              isLoading={isLoading}
              text={text}
              handleClick={handleClick}
              totalBlooms={totalBlooms}
              growth={growth}
              currentFlower={currentFlower}
              handleWalk={handleWalk}
              setShowTada={setShowTada}
            />
          )}

          {currentTab === "work" && (
            <WorkTab handleFloatCloud={handleFloatCloud} />
          )}

          {currentTab === "amulet" && <AmuletTab setShowTada={setShowTada} />}
        </AnimatePresence>
      </motion.div>

      {/* フローティング・ナビゲーションバー */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 px-6 pb-6 pt-2 pointer-events-none">
        <div className="bg-white/70 backdrop-blur-xl border-2 border-white shadow-[0_10px_40px_rgb(0,0,0,0.1)] rounded-[2rem] flex justify-around items-center p-2 pointer-events-auto">
          <button
            onClick={() => setCurrentTab("home")}
            className={`flex flex-col items-center justify-center w-24 h-16 rounded-2xl transition-all duration-300 ${currentTab === "home" ? "bg-sky-100/80 shadow-inner" : "hover:bg-sky-50"}`}
          >
            <span
              className={`text-xl mb-1 ${currentTab === "home" ? "scale-110" : "opacity-70"}`}
            >
              🏠
            </span>
            <span
              className={`text-[10px] font-bold ${currentTab === "home" ? "text-sky-600" : "text-sky-600/50"}`}
            >
              ホーム
            </span>
          </button>
          <button
            onClick={() => setCurrentTab("work")}
            className={`flex flex-col items-center justify-center w-24 h-16 rounded-2xl transition-all duration-300 ${currentTab === "work" ? "bg-sky-100/80 shadow-inner" : "hover:bg-sky-50"}`}
          >
            <span
              className={`text-xl mb-1 ${currentTab === "work" ? "scale-110" : "opacity-70"}`}
            >
              ☁️
            </span>
            <span
              className={`text-[10px] font-bold ${currentTab === "work" ? "text-sky-600" : "text-sky-600/50"}`}
            >
              ワーク
            </span>
          </button>
          <button
            onClick={() => setCurrentTab("amulet")}
            className={`flex flex-col items-center justify-center w-24 h-16 rounded-2xl transition-all duration-300 ${currentTab === "amulet" ? "bg-yellow-100/80 shadow-inner" : "hover:bg-yellow-50"}`}
          >
            <span
              className={`text-xl mb-1 ${currentTab === "amulet" ? "scale-110" : "opacity-70"}`}
            >
              🎉
            </span>
            <span
              className={`text-[10px] font-bold ${currentTab === "amulet" ? "text-yellow-600" : "text-yellow-600/50"}`}
            >
              お守り
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showTada && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-sky-900/40 backdrop-blur-sm p-4"
            onClick={() => setShowTada(false)}
          >
            <motion.div
              initial={{ scale: 0.5, rotate: -10, y: 50 }}
              animate={{ scale: 1, rotate: 0, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: "spring", bounce: 0.6, duration: 0.8 }}
              className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl border-4 border-yellow-300 text-center max-w-md w-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1 }}
                className="text-7xl mb-6"
              >
                🎉
              </motion.div>
              <h2 className="text-4xl font-black text-yellow-500 mb-4 tracking-widest drop-shadow-sm">
                Ta-Da!
              </h2>
              <p className="text-sky-800 font-extrabold text-xl mb-3">
                ナイストライ！👏
              </p>
              <p className="text-sky-700/80 text-base leading-relaxed mb-8 font-medium">
                失敗は「挑戦した証拠」であり、
                <br />
                とても貴重なデータです。
                <br />
                完璧じゃないあなたも、最高に素晴らしい!
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowTada(false)}
                className="bg-yellow-400 text-white font-bold py-4 px-10 rounded-full shadow-md hover:bg-yellow-500 transition-colors text-lg tracking-wider"
              >
                ありがとう!🌟
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
