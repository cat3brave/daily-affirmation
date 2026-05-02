"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
// 👇 新しく作った「通信パイプ」を呼び出します！
import { supabase } from "../../utils/supabase";

export default function ThreeGoodThingsCard() {
  const [things, setThings] = useState<string[]>(["", "", ""]);
  const [isSaved, setIsSaved] = useState(false);
  const [allRecords, setAllRecords] = useState<Record<string, string[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const getTodayDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getPast14Days = () => {
    const dates = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.push(`${year}-${month}-${day}`);
    }
    return dates;
  };

  useEffect(() => {
    const fetchRecords = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("ユーザー情報が取得できませんでした", userError);
        return;
      }

      const { data, error } = await supabase
        .from("three_good_things")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        console.error("3つのよかったこと取得エラー:", error);
        return;
      }

      if (data) {
        const recordsObj: Record<string, string[]> = {};

        data.forEach((row) => {
          recordsObj[row.date] = [
            row.things1 || "",
            row.things2 || "",
            row.things3 || "",
          ];
        });

        setAllRecords(recordsObj);

        const today = getTodayDate();
        if (recordsObj[today]) {
          setThings(recordsObj[today]);
        }
      }
    };

    fetchRecords();
  }, []);
  const handleChange = (index: number, value: string) => {
    const newThings = [...things];
    newThings[index] = value;
    setThings(newThings);
  };

  const handleSave = async () => {
    const today = getTodayDate();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("ユーザー情報が取得できませんでした", userError);
      alert(
        "ログイン情報を確認できませんでした。もう一度ログインしてください。",
      );
      return;
    }

    // まずは画面の見た目をすぐに更新する（サクサク動かすため）
    const updatedRecords = { ...allRecords, [today]: things };
    setAllRecords(updatedRecords);
    setIsSaved(true);
    setSelectedDate(today);

    // 同じユーザーの今日の記録だけ削除
    const { error: deleteError } = await supabase
      .from("three_good_things")
      .delete()
      .eq("user_id", user.id)
      .eq("date", today);

    if (deleteError) {
      console.error("古い記録の削除エラー:", deleteError);
      alert("前の記録を更新できませんでした。");
      return;
    }

    // user_id つきで新しく保存
    const { error: insertError } = await supabase
      .from("three_good_things")
      .insert({
        user_id: user.id,
        date: today,
        things1: things[0],
        things2: things[1],
        things3: things[2],
      });

    if (insertError) {
      console.error("保存エラー:", insertError);
      alert("記録を保存できませんでした。");
      return;
    }

    setTimeout(() => {
      setIsSaved(false);
    }, 3000);
  };

  const handleDelete = async (dateToDelete: string) => {
    if (!window.confirm(`${dateToDelete} の記録を削除してもよろしいですか？`))
      return;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("ユーザー情報が取得できませんでした", userError);
      alert(
        "ログイン情報を確認できませんでした。もう一度ログインしてください。",
      );
      return;
    }

    // 画面の見た目を更新する
    const updatedRecords = { ...allRecords };
    delete updatedRecords[dateToDelete];
    setAllRecords(updatedRecords);

    if (dateToDelete === getTodayDate()) {
      setThings(["", "", ""]);
    }

    setSelectedDate(null);

    // 自分のその日の記録だけ削除する
    const { error } = await supabase
      .from("three_good_things")
      .delete()
      .eq("user_id", user.id)
      .eq("date", dateToDelete);

    if (error) {
      console.error("削除エラー:", error);
      alert("記録を削除できませんでした。");
    }
  };
  const past14Days = getPast14Days();

  return (
    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-[2rem] shadow-sm border border-pink-50 w-full mb-24 flex flex-col items-center">
      <h3 className="text-pink-700 font-bold mb-2">🌷 3つのよかったこと</h3>
      <p className="text-pink-600/80 text-xs text-center mb-6">
        今日あった、どんなに小さなことでも大丈夫。
        <br />
        よかったことや、感謝したいことを3つ書いてみましょう。
      </p>

      <div className="w-full flex flex-col gap-3 mb-6">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="text-pink-400 font-bold mt-2">{index + 1}.</span>
            <textarea
              value={things[index]}
              onChange={(e) => handleChange(index, e.target.value)}
              placeholder={`（例：${["美味しいコーヒーを飲んだ", "天気が良くて気持ちよかった", "ゆっくり休めた"][index]}）`}
              className="w-full bg-pink-50/50 border border-pink-100 rounded-xl p-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-pink-200 resize-none h-16"
            />
          </div>
        ))}
      </div>

      <div className="relative w-full flex justify-center h-10 mb-4">
        <AnimatePresence mode="wait">
          {!isSaved ? (
            <motion.button
              key="save-button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={handleSave}
              className="bg-pink-400 hover:bg-pink-500 text-white px-8 py-2 rounded-full font-bold transition-colors shadow-sm"
            >
              記録する
            </motion.button>
          ) : (
            <motion.p
              key="saved-message"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-pink-600 font-bold flex items-center h-full"
            >
              ✨ 保存しました！今日もお疲れ様です ✨
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <div className="w-full bg-pink-50/30 rounded-xl p-4 flex flex-col items-center">
        <p className="text-[0.65rem] text-pink-400 font-bold mb-2">
          🌱 最近の記録（2週間）
        </p>
        <div className="flex gap-1 mb-2">
          {past14Days.map((date) => {
            const hasRecord =
              allRecords[date] &&
              allRecords[date].some((text) => text.trim() !== "");
            const isSelected = selectedDate === date;

            return (
              <button
                key={date}
                title={date}
                onClick={() => {
                  if (hasRecord) {
                    setSelectedDate(isSelected ? null : date);
                  }
                }}
                className={`w-4 h-4 rounded-[4px] transition-all ${
                  hasRecord
                    ? "bg-green-400 hover:bg-green-500 cursor-pointer shadow-sm"
                    : "bg-gray-100 cursor-default"
                } ${isSelected ? "ring-2 ring-pink-400 ring-offset-1 scale-110" : ""}`}
              />
            );
          })}
        </div>

        <AnimatePresence>
          {selectedDate && allRecords[selectedDate] && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full mt-2 bg-white/80 rounded-lg p-3 text-left shadow-sm border border-pink-100 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-2 border-b border-pink-100 pb-1">
                <p className="text-[0.7rem] font-bold text-pink-500">
                  📅 {selectedDate} のよかったこと
                </p>
                <button
                  onClick={() => handleDelete(selectedDate)}
                  className="text-pink-300 hover:text-red-400 transition-colors p-1"
                  title="この日の記録を削除"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>

              <ul className="flex flex-col gap-1">
                {allRecords[selectedDate].map(
                  (text, i) =>
                    text.trim() !== "" && (
                      <li key={i} className="text-sm text-gray-600 flex gap-2">
                        <span className="text-pink-300 font-bold">
                          {i + 1}.
                        </span>
                        {text}
                      </li>
                    ),
                )}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
