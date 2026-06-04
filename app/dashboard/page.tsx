"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { generateAffirmation } from "../actions";

// 🔴 新しく作ったカスタムフック（お花係）をインポート！
import { useFlowerGarden } from "../hooks/useFlowerGarden";

import HomeTab from "../components/HomeTab";
import WorkTab from "../components/WorkTab";
import AmuletTab from "../components/AmuletTab";
import BottomTabBar from "../components/BottomTabBar";
import TadaModal from "../components/TadaModal";
import BloomGraph from "../components/BloomGraph";

import { useRouter } from "next/navigation";
import LogoutButton from "../components/LogoutButton";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";

const FAVORITE_AFFIRMATIONS_STORAGE_KEY = "favoriteAffirmations";
const CLOUD_FLOAT_DURATION_MS = 8000;

type FloatingCloud = { id: string; text: string; x: number; y: number };

export default function Home() {
  const router = useRouter();
  // ユーザーのメールアドレスを入れておく箱を用意
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState<boolean>(false);

  // ブラウザ用の通信パイプを準備
  const [supabase] = useState(() => createSupabaseBrowserClient());
  // 画面が開いた瞬間に、裏側でユーザー情報を取ってくる
  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (error || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? "");
      setIsAuthChecked(true);
    };

    fetchUser();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  const [text, setText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [favoriteAffirmations, setFavoriteAffirmations] = useState<string[]>(
    [],
  );
  const [hasLoadedFavorites, setHasLoadedFavorites] = useState(false);

  useEffect(() => {
    const savedFavorites = localStorage.getItem(
      FAVORITE_AFFIRMATIONS_STORAGE_KEY,
    );

    if (savedFavorites) {
      try {
        const parsedFavorites = JSON.parse(savedFavorites);

        if (Array.isArray(parsedFavorites)) {
          setFavoriteAffirmations(
            parsedFavorites.filter(
              (favorite): favorite is string => typeof favorite === "string",
            ),
          );
        }
      } catch {
        console.error("お気に入りアファメーションの読み込みに失敗しました。");
      }
    }

    setHasLoadedFavorites(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedFavorites) return;

    localStorage.setItem(
      FAVORITE_AFFIRMATIONS_STORAGE_KEY,
      JSON.stringify(favoriteAffirmations),
    );
  }, [favoriteAffirmations, hasLoadedFavorites]);

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;

    const fetchFavoriteAffirmations = async () => {
      const { data, error } = await supabase
        .from("favorite_affirmations")
        .select("text")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        setFavoriteAffirmations(
          data
            .map((favorite) => favorite.text)
            .filter((text): text is string => typeof text === "string"),
        );
      }
    };

    fetchFavoriteAffirmations();

    return () => {
      isMounted = false;
    };
  }, [supabase, userId]);

  const [isBirdView, setIsBirdView] = useState<boolean>(false);
  const [showTada, setShowTada] = useState<boolean>(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [currentTab, setCurrentTab] = useState<"home" | "work" | "amulet">(
    "home",
  );
  const [floatingClouds, setFloatingClouds] = useState<FloatingCloud[]>([]);
  const cloudTimeoutIds = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 🔴 ここがプロの技！お花に関するデータと機能を、フックから一行で受け取る！
  const { growth, totalBlooms, currentFlower, isBloomSaving, handleWalk } =
    useFlowerGarden(userId, supabase);

  useEffect(() => {
    const handleResize = () =>
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleClick = async () => {
    if (isLoading) return;
    setIsLoading(true);
    setText("");
    try {
      const newText = await generateAffirmation();
      setText(newText);
    } catch {
      setText("深呼吸して、もう一度試してみてくださいね。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFavoriteAffirmation = () => {
    if (!text.trim()) return;

    setFavoriteAffirmations((prev) => {
      if (prev.includes(text)) return prev;
      return [text, ...prev];
    });
  };

  const handleRemoveFavoriteAffirmation = (affirmationToRemove: string) => {
    setFavoriteAffirmations((prev) =>
      prev.filter((affirmation) => affirmation !== affirmationToRemove),
    );
  };

  const isFavoriteDisabled =
    !text.trim() || favoriteAffirmations.includes(text);

  useEffect(() => {
    return () => {
      cloudTimeoutIds.current.forEach((timeoutId) => clearTimeout(timeoutId));
      cloudTimeoutIds.current = [];
    };
  }, []);

  const handleFloatCloud = (cloudText: string) => {
    const cloudId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    const newCloud = {
      id: cloudId,
      text: cloudText,
      x: (Math.random() - 0.5) * 100,
      y: -300 - Math.random() * 100,
    };

    setFloatingClouds((prev) => [...prev, newCloud]);

    const timeoutId = setTimeout(() => {
      setFloatingClouds((prev) => prev.filter((c) => c.id !== newCloud.id));
      cloudTimeoutIds.current = cloudTimeoutIds.current.filter(
        (currentTimeoutId) => currentTimeoutId !== timeoutId,
      );
    }, CLOUD_FLOAT_DURATION_MS);

    cloudTimeoutIds.current.push(timeoutId);
  };

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
      className={`relative flex min-h-screen flex-col items-center p-6 pb-32 overflow-hidden transition-colors duration-1000 ${isBirdView ? "bg-sky-100" : "bg-transparent"}`}
    >
      <header className="w-full max-w-lg absolute top-4 flex justify-between items-start px-6 z-50">
        {/* 👇 ホーム画面の時だけボタンを表示、それ以外は透明な空箱を置く */}
        {currentTab === "home" ? (
          <button
            onClick={() => setIsBirdView(!isBirdView)}
            className="bg-white/80 backdrop-blur-sm hover:bg-white text-sky-600 px-4 py-2 rounded-full shadow-sm border border-sky-100 font-bold tracking-wide transition-all text-sm"
          >
            {isBirdView ? "🌱 地上に戻る" : "🕊️ 鳥の目線になる"}
          </button>
        ) : (
          <div className="w-[120px]"></div>
        )}

        <div className="flex flex-col items-end gap-1">
          <LogoutButton />

          {userEmail && (
            <p className="text-xs text-gray-500 font-medium truncate max-w-[120px]">
              {userEmail.split("@")[0]} さん🌷
            </p>
          )}
        </div>
      </header>

      {/* ☁️ 雲のアニメーション */}
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

      <AnimatePresence>
        {currentTab === "home" && isBirdView && (
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
              handleFavoriteAffirmation={handleFavoriteAffirmation}
              isFavoriteDisabled={isFavoriteDisabled}
              favoriteAffirmations={favoriteAffirmations}
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
