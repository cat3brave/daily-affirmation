import { useCallback, useEffect, useRef, useState } from "react";
import type { createSupabaseBrowserClient } from "../lib/supabaseClient";

const FLOWER_STAGES = ["🌰", "🌱", "🌿", "🌷", "🌸"];
const RARE_FLOWERS = ["🌺", "🌻", "🌼", "🍀", "🌹", "🍄"];
const LAST_STAGE_INDEX = FLOWER_STAGES.length - 1;

type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

export function useFlowerGarden(
  userId: string | null,
  supabase: SupabaseBrowserClient,
) {
  const [growth, setGrowth] = useState<number>(0);
  const [totalBlooms, setTotalBlooms] = useState<number>(0);
  const [currentFlower, setCurrentFlower] = useState<string>("🌸");
  const [isBloomSaving, setIsBloomSaving] = useState<boolean>(false);
  const [flowerError, setFlowerError] = useState<string>("");
  const [flowerLoadError, setFlowerLoadError] = useState<string>("");
  const [isReloadingBlooms, setIsReloadingBlooms] = useState(false);
  const loadRequestRef = useRef(0);
  const loadInFlightRef = useRef(false);
  const [bloomRefreshKey, setBloomRefreshKey] = useState<number>(0);

  // ☁️ ログイン済みユーザーが確定したら「お花の数」を取ってくる
  const fetchBlooms = useCallback(async () => {
      if (!userId || loadInFlightRef.current) return;
      const requestId = ++loadRequestRef.current;
      loadInFlightRef.current = true;
      setIsReloadingBlooms(true);
      try {
        const { count, error } = await supabase
          .from("bloom_logs")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        if (requestId !== loadRequestRef.current) {
          return;
        }

        if (error) {
          console.error("bloom_logs count fetch error:", error);
          setFlowerLoadError(
            "お花の記録を読み込めませんでした。時間をおいて、もう一度お試しください。",
          );
          return;
        }

        if (count !== null) {
          setTotalBlooms(count);
        }
        setFlowerLoadError("");
      } catch (error) {
        console.error("bloom_logs count fetch unexpected error:", error);
        if (requestId === loadRequestRef.current) {
          setFlowerLoadError(
            "お花の記録を読み込めませんでした。時間をおいて、もう一度お試しください。",
          );
        }
      } finally {
        if (requestId === loadRequestRef.current) {
          loadInFlightRef.current = false;
          setIsReloadingBlooms(false);
        }
      }
  }, [supabase, userId]);

  useEffect(() => {
    setTotalBlooms(0);
    setFlowerError("");
    setFlowerLoadError("");
    loadRequestRef.current += 1;
    loadInFlightRef.current = false;
    if (!userId) return;
    fetchBlooms();

    return () => {
      loadRequestRef.current += 1;
      loadInFlightRef.current = false;
    };
  }, [fetchBlooms, userId]);

  // 🌱 お散歩ボタンを押した時の処理
  const handleWalk = useCallback(async () => {
    if (isBloomSaving) return;

    setFlowerError("");

    // すでに満開なら、次は新しい種に戻すだけ（カウントは増やさない）
    if (growth >= LAST_STAGE_INDEX) {
      setGrowth(0);
      return;
    }

    const nextGrowth = growth + 1;

    // 満開前の成長はすぐに画面へ反映する
    if (nextGrowth < LAST_STAGE_INDEX) {
      setGrowth(nextGrowth);
      return;
    }

    if (!userId) {
      setFlowerError(
        "ログイン情報を確認できませんでした。もう一度ログインしてください。",
      );
      return;
    }

    const rand = Math.random();
    let nextFlower = "🌸";

    // 30%の確率でレアな花が咲く！ガチャ機能！
    if (rand > 0.7) {
      nextFlower =
        RARE_FLOWERS[Math.floor(Math.random() * RARE_FLOWERS.length)];
    }

    setIsBloomSaving(true);

    try {
      const { error } = await supabase
        .from("bloom_logs")
        .insert({ user_id: userId, flower_type: nextFlower });

      if (error) {
        console.error("ログ保存エラー:", error);
        setFlowerError(
          "お花の記録を保存できませんでした。もう一度お試しください。",
        );
        return;
      }

      setCurrentFlower(nextFlower);
      setTotalBlooms((prev) => prev + 1);
      setBloomRefreshKey((prev) => prev + 1);
      setGrowth(nextGrowth);
    } catch (error) {
      console.error("ログ保存中の想定外エラー:", error);
      setFlowerError(
        "お花の記録を保存できませんでした。もう一度お試しください。",
      );
    } finally {
      setIsBloomSaving(false);
    }
  }, [growth, isBloomSaving, supabase, userId]);

  return {
    growth,
    totalBlooms,
    currentFlower,
    isBloomSaving,
    flowerError,
    flowerLoadError,
    isReloadingBlooms,
    reloadBlooms: fetchBlooms,
    bloomRefreshKey,
    handleWalk,
  };
}
