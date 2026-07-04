import { useCallback, useEffect, useState } from "react";
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

  // ☁️ ログイン済みユーザーが確定したら「お花の数」を取ってくる
  useEffect(() => {
    setTotalBlooms(0);
    setFlowerError("");

    if (!userId) {
      return;
    }

    let isMounted = true;

    const fetchBlooms = async () => {
      const { count, error } = await supabase
        .from("bloom_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error("bloom_logs count fetch error:", error);
        setFlowerError(
          "お花の記録を読み込めませんでした。時間をおいて、もう一度お試しください。",
        );
        return;
      }

      if (count !== null) {
        setTotalBlooms(count);
        setFlowerError("");
      }
    };

    fetchBlooms();

    return () => {
      isMounted = false;
    };
  }, [supabase, userId]);

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
      setGrowth(nextGrowth);
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
    handleWalk,
  };
}
