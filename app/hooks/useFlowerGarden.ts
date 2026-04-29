import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

const FLOWER_STAGES = ["🌰", "🌱", "🌿", "🌷", "🌸"];
const RARE_FLOWERS = ["🌺", "🌻", "🌼", "🍀", "🌹", "🍄"];
const LAST_STAGE_INDEX = FLOWER_STAGES.length - 1;

export function useFlowerGarden() {
  const [growth, setGrowth] = useState<number>(0);
  const [totalBlooms, setTotalBlooms] = useState<number>(0);
  const [currentFlower, setCurrentFlower] = useState<string>("🌸");
  const [userId, setUserId] = useState<string | null>(null);

  // ブラウザ用の通信パイプを準備（これ1つでOK！）
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ),
  );

  // ☁️ 画面が開いた時に、ログイン情報を確認して「お花の数」を取ってくる
  useEffect(() => {
    const fetchUserDataAndBlooms = async () => {
      // 1. 今ログインしている人を確認する
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // ユーザーIDを記憶しておく（お花を咲かせた時の保存用）
      setUserId(user.id);

      // 2. その人の bloom_logs（お花の記録）を数える
      const { count, error } = await supabase
        .from("bloom_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // 3. エラーがなく、数が取れたら画面にセットする
      if (!error && count !== null) {
        setTotalBlooms(count);
      }
    };

    fetchUserDataAndBlooms();
  }, []); // 👈 画面を開いた時の「最初の一回だけ」実行

  // 🌱 お散歩ボタンを押した時の処理
  const handleWalk = async () => {
    // await を使うために async をつけます
    // すでに満開なら、次は新しい種に戻すだけ（カウントは増やさない）
    if (growth >= LAST_STAGE_INDEX) {
      setGrowth(0);
      return;
    }

    const nextGrowth = growth + 1;
    setGrowth(nextGrowth);

    // 🌸 咲いた瞬間に、花の種類決定と保存を行う！
    if (nextGrowth === LAST_STAGE_INDEX) {
      const rand = Math.random();
      let nextFlower = "🌸";

      // 30%の確率でレアな花が咲く！ガチャ機能！
      if (rand > 0.7) {
        nextFlower =
          RARE_FLOWERS[Math.floor(Math.random() * RARE_FLOWERS.length)];
      }

      // 先に画面の数字と花の種類を変える（ユーザーを待たせないため）
      setCurrentFlower(nextFlower);
      setTotalBlooms((prev) => prev + 1);

      // ☁️ クラウド(Supabase)の bloom_logs に「いつ・何が咲いたか」記録を残す
      if (userId) {
        const { error } = await supabase
          .from("bloom_logs")
          .insert({ user_id: userId, flower_type: nextFlower });

        if (error) {
          console.error("ログ保存エラー:", error);
        }
      }
    }
  };

  return { growth, totalBlooms, currentFlower, handleWalk };
}
