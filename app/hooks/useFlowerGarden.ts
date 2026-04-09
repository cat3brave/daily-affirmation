import { useState, useEffect } from "react";
import { supabase } from "../../utils/supabase";

const FLOWER_STAGES = ["🌰", "🌱", "🌿", "🌷", "🌸"];
const RARE_FLOWERS = ["🌺", "🌻", "🌼", "🍀", "🌹", "🍄"];
const LAST_STAGE_INDEX = FLOWER_STAGES.length - 1;

export function useFlowerGarden() {
  const [growth, setGrowth] = useState<number>(0);
  const [totalBlooms, setTotalBlooms] = useState<number>(0);
  const [currentFlower, setCurrentFlower] = useState<string>("🌸");
  const [userId, setUserId] = useState<string | null>(null);

  // ☁️ アプリを開いたとき、クラウド(Supabase)からお花の数を取ってくる
  useEffect(() => {
    const fetchUserData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUserId(session.user.id);
        const { data } = await supabase
          .from("profiles")
          .select("total_blooms")
          .eq("id", session.user.id)
          .single();

        if (data) {
          setTotalBlooms(data.total_blooms || 0);
        }
      }
    };

    fetchUserData();
  }, []);

  const handleWalk = () => {
    // すでに満開なら、次は新しい種に戻すだけ（カウントは増やさない）
    if (growth >= LAST_STAGE_INDEX) {
      setGrowth(0);
      return;
    }

    const nextGrowth = growth + 1;
    setGrowth(nextGrowth);

    // 🌸 咲いた瞬間に、花の種類決定と totalBlooms 加算を行う！
    if (nextGrowth === LAST_STAGE_INDEX) {
      const rand = Math.random();
      let nextFlower = "🌸";

      // 30%の確率でレアな花が咲く！ガチャ機能！
      if (rand > 0.7) {
        nextFlower =
          RARE_FLOWERS[Math.floor(Math.random() * RARE_FLOWERS.length)];
      }

      const newTotal = totalBlooms + 1;

      setCurrentFlower(nextFlower);
      setTotalBlooms(newTotal);

      // ☁️ クラウド(Supabase)にしっかり保存する！
      if (userId) {
        supabase
          .from("profiles")
          .upsert({ id: userId, total_blooms: newTotal })
          .then(({ error }) => {
            if (error) console.error("保存エラー:", error);
          });
      }
    }
  };

  return { growth, totalBlooms, currentFlower, handleWalk };
}
