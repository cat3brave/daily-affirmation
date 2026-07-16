"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";

const supabase = createSupabaseBrowserClient();

type BloomCounts = {
  [date: string]: number;
};

const BLOOM_LOGS_LOAD_ERROR_MESSAGE =
  "お花の成長記録を読み込めませんでした。時間をおいて、もう一度お試しください。";

export default function BloomGraph() {
  const [bloomData, setBloomData] = useState<BloomCounts>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const { days, startDate } = useMemo(() => {
    // 🗓️ GitHubのようにはじめを「日曜日」に揃えるための計算
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 84);

    // 始まりの日を直近の「日曜日」に巻き戻す
    const startDayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDayOfWeek);

    // 終わりの日（今日）が属する週の「土曜日」までマスを作る
    const endDayOfWeek = endDate.getDay();
    const finalDate = new Date(endDate);
    finalDate.setDate(finalDate.getDate() + (6 - endDayOfWeek));

    const daysArray: { date: string; isFuture: boolean }[] = [];
    const iterDate = new Date(startDate);

    while (iterDate <= finalDate) {
      const y = iterDate.getFullYear();
      const m = String(iterDate.getMonth() + 1).padStart(2, "0");
      const day = String(iterDate.getDate()).padStart(2, "0");

      daysArray.push({
        date: `${y}-${m}-${day}`,
        isFuture: iterDate > endDate,
      });

      iterDate.setDate(iterDate.getDate() + 1);
    }

    return { days: daysArray, startDate };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const fetchLogs = async () => {
      if (isMounted) {
        setLoadError("");
        setLoading(true);
      }

      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("セッション取得エラー:", sessionError);
          if (isMounted) {
            setLoadError(BLOOM_LOGS_LOAD_ERROR_MESSAGE);
          }
          return;
        }

        if (!session?.user) {
          console.error("ログインユーザーが確認できませんでした。");
          if (isMounted) {
            setLoadError(BLOOM_LOGS_LOAD_ERROR_MESSAGE);
          }
          return;
        }

        const userId = session.user.id;

        const { data, error } = await supabase
          .from("bloom_logs")
          .select("created_at")
          .eq("user_id", userId)
          .gte("created_at", startDate.toISOString());

        if (error) {
          console.error("ログ取得エラー:", error);
          if (isMounted) {
            setLoadError(BLOOM_LOGS_LOAD_ERROR_MESSAGE);
          }
          return;
        }

        const counts: BloomCounts = {};

        data?.forEach((log) => {
          const d = new Date(log.created_at);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          const dateStr = `${y}-${m}-${day}`;
          counts[dateStr] = (counts[dateStr] || 0) + 1;
        });

        if (isMounted) {
          setBloomData(counts);
        }
      } catch (error) {
        console.error("成長記録取得中に想定外のエラー:", error);
        if (isMounted) {
          setLoadError(BLOOM_LOGS_LOAD_ERROR_MESSAGE);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchLogs();

    return () => {
      isMounted = false;
    };
  }, [startDate]);

  if (loading) {
    return (
      <div className="text-sm text-gray-500 text-center py-8">
        成長記録を読み込み中...🌱
      </div>
    );
  }

  return (
    <div className="bg-white/90 backdrop-blur-sm p-5 rounded-3xl shadow-lg border border-sky-100 overflow-x-auto">
      {/* 上部のタイトルと凡例 */}
      <div className="flex items-end mb-4 justify-between min-w-[300px]">
        <h3 className="text-sm font-bold text-sky-800">
          お花の成長記録（過去3ヶ月）
        </h3>
        {!loadError && (
          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold">
            <span>少</span>
            <div className="w-3 h-3 rounded-sm bg-gray-100" />
            <div className="w-3 h-3 rounded-sm bg-pink-200" />
            <div className="w-3 h-3 rounded-sm bg-pink-300" />
            <div className="w-3 h-3 rounded-sm bg-pink-500" />
            <span>多</span>
          </div>
        )}
      </div>

      {loadError ? (
        <p
          role="alert"
          className="min-w-[300px] rounded-xl border border-red-100 bg-red-50/60 px-3 py-3 text-center text-xs font-bold leading-relaxed text-red-500"
        >
          {loadError}
        </p>
      ) : (
        <div className="flex gap-2 min-w-max">
          {/* 左側の曜日ラベル */}
          <div className="flex flex-col text-[10px] text-sky-600/60 font-bold justify-between py-[2px] pr-1">
            <span>日</span>
            <span>月</span>
            <span>火</span>
            <span>水</span>
            <span>木</span>
            <span>金</span>
            <span>土</span>
          </div>

          {/* 🌿 ここがプロの技！縦7行で折り返すグリッド */}
          <div className="grid grid-rows-7 grid-flow-col gap-1">
            {days.map((item) => {
              const count = bloomData[item.date] || 0;

              // まだ来ていない未来の日付は、マスを見えなくする（透明）
              if (item.isFuture) {
                return (
                  <div
                    key={item.date}
                    className="w-3 h-3 rounded-sm bg-transparent"
                  />
                );
              }

              // お花の数によって色の濃さを変える
              let bgColor = "bg-gray-100";
              if (count === 1) bgColor = "bg-pink-200";
              if (count === 2) bgColor = "bg-pink-300";
              if (count >= 3) bgColor = "bg-pink-500";

              return (
                <div
                  key={item.date}
                  title={`${item.date} : ${count}回咲いた`}
                  className={`w-3 h-3 rounded-sm ${bgColor} transition-all duration-300 hover:ring-2 hover:ring-pink-400 hover:ring-offset-1 cursor-pointer`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
