"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../utils/supabase";

type BloomCounts = {
  [date: string]: number;
};

export default function BloomGraph() {
  const [bloomData, setBloomData] = useState<BloomCounts>({});
  const [loading, setLoading] = useState(true);

  // 今日から過去30日分の日付（YYYY-MM-DD）の配列を作成
  const days = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });

  useEffect(() => {
    const fetchLogs = async () => {
      // 1. 現在のログインユーザーを取得
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }
      const userId = session.user.id;

      // 2. 過去30日間の基準日を計算
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // 3. Supabaseの bloom_logs からデータを取得
      const { data, error } = await supabase
        .from("bloom_logs")
        .select("created_at")
        .eq("user_id", userId)
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (error) {
        console.error("ログ取得エラー:", error);
        return;
      }

      // 4. 取得した日付データを「YYYY-MM-DD」ごとに数え上げる
      const counts: BloomCounts = {};
      data?.forEach((log) => {
        const d = new Date(log.created_at);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const dateStr = `${y}-${m}-${day}`;

        counts[dateStr] = (counts[dateStr] || 0) + 1;
      });

      setBloomData(counts);
      setLoading(false);
    };

    fetchLogs();
  }, []);

  if (loading) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        成長記録を読み込み中...🌱
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
      <h3 className="text-sm font-bold text-gray-700 mb-3">
        最近30日間の成長（草）
      </h3>
      <div className="flex flex-wrap gap-1">
        {days.map((date) => {
          const count = bloomData[date] || 0;

          // お花の数によって色の濃さを変える（GitHubの草ロジック）
          let bgColor = "bg-gray-100"; // 0回
          if (count === 1) bgColor = "bg-pink-200";
          if (count === 2) bgColor = "bg-pink-300";
          if (count >= 3) bgColor = "bg-pink-500";

          return (
            <div
              key={date}
              title={`${date}: ${count}回咲いた`}
              className={`w-4 h-4 rounded-sm ${bgColor} transition-colors duration-300`}
            />
          );
        })}
      </div>
    </div>
  );
}
