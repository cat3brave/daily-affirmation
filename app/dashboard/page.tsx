"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthUser } from "../hooks/useAuthUser";

// 🔴 新しく作ったカスタムフック（お花係）をインポート！
import { useFlowerGarden } from "../hooks/useFlowerGarden";
import { useAffirmationGenerator } from "../hooks/useAffirmationGenerator";
import { useFavoriteAffirmations } from "../hooks/useFavoriteAffirmations";
import { useFloatingClouds } from "../hooks/useFloatingClouds";
import { useWindowSize } from "../hooks/useWindowSize";

import HomeTab from "../components/HomeTab";
import WorkTab from "../components/WorkTab";
import AmuletTab from "../components/AmuletTab";
import BottomTabBar from "../components/BottomTabBar";
import TadaModal from "../components/TadaModal";
import BloomGraph from "../components/BloomGraph";
import FloatingCloudLayer from "../components/FloatingCloudLayer";
import BirdViewPanel from "../components/BirdViewPanel";
import DashboardHeader from "../components/DashboardHeader";

export default function Home() {
  const { supabase, userId, userEmail, isAuthChecked } = useAuthUser();

  const { text, isLoading, handleGenerateAffirmation } =
    useAffirmationGenerator();
  const {
    favoriteAffirmations,
    favoriteError,
    handleFavoriteAffirmation: saveFavoriteAffirmation,
    handleRemoveFavoriteAffirmation,
    isFavorite,
  } = useFavoriteAffirmations(userId, supabase);

  const [isBirdView, setIsBirdView] = useState<boolean>(false);
  const [showTada, setShowTada] = useState<boolean>(false);
  const { windowSize } = useWindowSize();
  const [currentTab, setCurrentTab] = useState<"home" | "work" | "amulet">(
    "home",
  );
  const { floatingClouds, handleFloatCloud } = useFloatingClouds();

  // 🔴 ここがプロの技！お花に関するデータと機能を、フックから一行で受け取る！
  const { growth, totalBlooms, currentFlower, isBloomSaving, handleWalk } =
    useFlowerGarden(userId, supabase);

  const handleFavoriteAffirmation = async () => {
    await saveFavoriteAffirmation(text);
  };

  const isFavoriteDisabled = !userId || !text.trim() || isFavorite(text);

  if (!isAuthChecked) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center p-6 bg-sky-50 text-sky-700">
        <p className="bg-white/80 backdrop-blur-sm rounded-full px-6 py-4 shadow-sm border border-sky-100 font-bold tracking-wide">
          ログイン情報を確認しています...
        </p>
      </main>
    );
  }

  return (
    <main
      className={`relative flex min-h-screen flex-col items-center p-6 pb-32 overflow-hidden transition-colors duration-1000 ${
        isBirdView ? "bg-sky-100" : "bg-transparent"
      }`}
    >
      <DashboardHeader
        currentTab={currentTab}
        isBirdView={isBirdView}
        onToggleBirdView={() => setIsBirdView(!isBirdView)}
        userEmail={userEmail}
      />

      <FloatingCloudLayer floatingClouds={floatingClouds} />

      <BirdViewPanel
        currentTab={currentTab}
        isBirdView={isBirdView}
        totalBlooms={totalBlooms}
      />

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
              handleClick={handleGenerateAffirmation}
              handleFavoriteAffirmation={handleFavoriteAffirmation}
              isFavoriteDisabled={isFavoriteDisabled}
              favoriteAffirmations={favoriteAffirmations}
              favoriteError={favoriteError}
              handleRemoveFavoriteAffirmation={handleRemoveFavoriteAffirmation}
              totalBlooms={totalBlooms}
              growth={growth}
              currentFlower={currentFlower}
              isBloomSaving={isBloomSaving}
              handleWalk={handleWalk}
              setShowTada={setShowTada}
            />
          )}

          {currentTab === "work" && (
            <WorkTab handleFloatCloud={handleFloatCloud} />
          )}

          {currentTab === "amulet" && <AmuletTab setShowTada={setShowTada} />}
        </AnimatePresence>

        {/* 🟢 ここにグラフを配置して、上部に少し余白(mt-8)を作ります */}
        {/* 👇 波括弧で囲んで、ホーム画面の時だけ表示するようにする！ */}
        {currentTab === "home" && (
          <div className="w-full mt-8">
            <BloomGraph />
          </div>
        )}
      </motion.div>

      <BottomTabBar currentTab={currentTab} setCurrentTab={setCurrentTab} />

      <TadaModal
        showTada={showTada}
        setShowTada={setShowTada}
        windowSize={windowSize}
      />
    </main>
  );
}
