"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
// 👇 新しく作った「通信パイプ」を呼び出します！
import { useDashboardOperation } from "../hooks/dashboardAuth";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import {
  readThreeGoodThingsDraft,
  removeThreeGoodThingsDraft,
  writeThreeGoodThingsDraft,
} from "../lib/threeGoodThingsDraft";

const loadErrorMessage =
  "記録を読み込めませんでした。時間をおいて、もう一度お試しください。";
const accountChangedMessage =
  "ログインしている利用者が変わりました。内容を確認してから、もう一度操作してください。";

function getTodayDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function ThreeGoodThingsCard() {
  const { capture, auth } = useDashboardOperation();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [inputDate, setInputDate] = useState(getTodayDate);
  const inputDateRef = useRef(inputDate);
  const [todayDate, setTodayDate] = useState(getTodayDate);
  const editorInitializedRef = useRef(false);
  // Shared synchronous lock: state alone cannot guard same-turn calls.
  const mutationRef = useRef<symbol | null>(null);
  const [things, setThings] = useState<string[]>(["", "", ""]);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [allRecords, setAllRecords] = useState<Record<string, string[]>>({});
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const authUserIdRef = useRef<string | null | undefined>(undefined);
  const authGenerationRef = useRef(0);
  const [draftRestored, setDraftRestored] = useState(false);
  const savedThingsRef = useRef<string[]>(["", "", ""]);
  const isMountedRef = useRef(true);
  const loadRequestRef = useRef(0);
  const savedMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearSavedMessage = useCallback(() => {
    if (savedMessageTimeoutRef.current !== null) {
      clearTimeout(savedMessageTimeoutRef.current);
      savedMessageTimeoutRef.current = null;
    }
    setIsSaved(false);
  }, []);

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

  const fetchRecords = useCallback(() => {
      const current = capture();
      if (!current() || mutationRef.current) return;
      const targetDate = inputDateRef.current;
      const authGeneration = authGenerationRef.current;
      const requestId = ++loadRequestRef.current;

      return supabase.auth.getUser().catch((error) => {
        if (current()) auth?.onOwnerMismatch(null);
        throw error;
      }).then(async ({ data: { user }, error: userError }) => {

        if (
          !current() ||
          requestId !== loadRequestRef.current ||
          authGeneration !== authGenerationRef.current
        ) return;

        if (userError || !user) {
          auth?.onOwnerMismatch(null);
          console.error("ユーザー情報が取得できませんでした", userError);
          if (current() && requestId === loadRequestRef.current) {
            setLoadError(loadErrorMessage);
          }
          return;
        }

        if (
          authUserIdRef.current !== undefined &&
          authUserIdRef.current !== user.id
        ) {
          auth?.onOwnerMismatch(user.id);
          return;
        }
        authUserIdRef.current = user.id;

        const initializeEditor = !editorInitializedRef.current;
        const draft = initializeEditor
          ? readThreeGoodThingsDraft(user.id, targetDate)
          : null;
        if (draft) editorInitializedRef.current = true;
        userIdRef.current = user.id;
        setUserId(user.id);
        if (draft) {
          setThings(draft);
          setDraftRestored(true);
        }

        const { data, error } = await supabase
          .from("three_good_things")
          .select("*")
          .eq("user_id", user.id);

        if (!current() || requestId !== loadRequestRef.current || authGeneration !== authGenerationRef.current) return;
        if (error) {
          console.error("3つのよかったこと取得エラー:", error);
          if (current() && requestId === loadRequestRef.current) {
            setLoadError(loadErrorMessage);
          }
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

          if (
            !current() ||
            requestId !== loadRequestRef.current ||
            authGeneration !== authGenerationRef.current ||
            authUserIdRef.current !== user.id
          ) return;

          setAllRecords(recordsObj);

          const savedThings = recordsObj[targetDate] ?? ["", "", ""];
          savedThingsRef.current = savedThings;
          if (initializeEditor) {
            setThings(draft ?? savedThings);
            setDraftRestored(Boolean(draft));
          }
          editorInitializedRef.current = true;
          setLoadError("");
        }
      }).catch((error) => {
        console.error("3つのよかったこと取得中に想定外のエラー:", error);
        if (
          current() && requestId === loadRequestRef.current &&
          authGeneration === authGenerationRef.current
        ) {
          setLoadError(loadErrorMessage);
        }
      }).finally(() => {
        if (current() && requestId === loadRequestRef.current) {
          setIsLoadingRecords(false);
        }
      });
  }, [auth, capture, supabase]);

  useEffect(() => {
    isMountedRef.current = true;

    if (auth) authUserIdRef.current = auth.userId;
    fetchRecords();

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const authListener = auth ? null : supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUserId = session?.user?.id ?? null;
        if (authUserIdRef.current === nextUserId) return;

        authUserIdRef.current = nextUserId;
        authGenerationRef.current += 1;
        loadRequestRef.current += 1;
        mutationRef.current = null;
        editorInitializedRef.current = false;
        inputDateRef.current = getTodayDate();
        setInputDate(inputDateRef.current);
        userIdRef.current = null;
        setUserId(null);
        setThings(["", "", ""]);
        savedThingsRef.current = ["", "", ""];
        setAllRecords({});
        setSelectedDate(null);
        setDraftRestored(false);
        setIsSaved(false);
        setSaveError(nextUserId ? accountChangedMessage : "");
        setDeleteError("");
        setLoadError(nextUserId ? "" : accountChangedMessage);
        setIsSaving(false);
        setIsLoadingRecords(Boolean(nextUserId));
        setDeletingDate(null);
        if (savedMessageTimeoutRef.current) {
          clearTimeout(savedMessageTimeoutRef.current);
          savedMessageTimeoutRef.current = null;
        }

        if (refreshTimer) clearTimeout(refreshTimer);
        if (nextUserId) {
          refreshTimer = setTimeout(() => { void fetchRecords(); }, 0);
        } else {
          setIsLoadingRecords(false);
        }
      },
    );

    return () => {
      isMountedRef.current = false;
      mutationRef.current = null;
      authGenerationRef.current += 1;
      loadRequestRef.current += 1;
      authListener?.data.subscription.unsubscribe();
      if (refreshTimer) clearTimeout(refreshTimer);
      if (savedMessageTimeoutRef.current) {
        clearTimeout(savedMessageTimeoutRef.current);
      }
    };
  }, [auth, fetchRecords, supabase.auth]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const checkDate = () => {
      clearTimeout(timer);
      setTodayDate(getTodayDate());
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(checkDate, midnight.getTime() - now.getTime());
    };
    checkDate();
    window.addEventListener("focus", checkDate);
    window.addEventListener("pageshow", checkDate);
    document.addEventListener("visibilitychange", checkDate);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", checkDate);
      window.removeEventListener("pageshow", checkDate);
      document.removeEventListener("visibilitychange", checkDate);
    };
  }, []);

  const handleToday = () => {
    if (!capture()() || mutationRef.current || isLoadingRecords || !userId) return;
    const today = getTodayDate();
    if (today === inputDateRef.current) return;
    const dirty = things.some((thing, index) => thing !== savedThingsRef.current[index]);
    if (dirty && !window.confirm("未保存の変更を破棄して、今日の入力へ切り替えますか？")) return;
    if (!capture()() || mutationRef.current) return;
    clearSavedMessage();
    const saved = allRecords[today] ?? ["", "", ""];
    const draft = readThreeGoodThingsDraft(userId, today);
    savedThingsRef.current = saved;
    inputDateRef.current = today;
    setInputDate(today);
    setTodayDate(today);
    setThings(draft ?? saved);
    setDraftRestored(Boolean(draft));
    setSaveError("");
    setDeleteError("");
    setSelectedDate(null);
    // Refresh today's saved record too: it may have been saved in another tab.
    editorInitializedRef.current = false;
    setIsLoadingRecords(true);
    void fetchRecords();
  };

  const handleChange = (index: number, value: string) => {
    if (!capture()() || mutationRef.current || isLoadingRecords || !userId) return;
    editorInitializedRef.current = true;
    clearSavedMessage();
    const newThings = [...things];
    newThings[index] = value;
    setThings(newThings);
    setDraftRestored(false);

    if (!userId) return;
    if (
      !newThings.some((thing) => thing.trim() !== "") ||
      newThings.every((thing, thingIndex) => thing === savedThingsRef.current[thingIndex])
    ) {
      removeThreeGoodThingsDraft(userId);
    } else {
      writeThreeGoodThingsDraft(userId, inputDateRef.current, newThings);
    }
  };

  const handleSave = async () => {
    const operation = Symbol();
    const current = capture();
    const displayedUserId = userIdRef.current;
    const authGeneration = authGenerationRef.current;
    const isCurrentOperation = () =>
      current() && isMountedRef.current &&
      (mutationRef.current === null || mutationRef.current === operation) &&
      authGenerationRef.current === authGeneration &&
      authUserIdRef.current === displayedUserId &&
      userIdRef.current === displayedUserId;
    if (
      !isCurrentOperation() ||
      mutationRef.current !== null ||
      !displayedUserId ||
      authUserIdRef.current !== displayedUserId ||
      isLoadingRecords
    ) return;

    const normalizedThings = things.map((thing) => thing.trim());
    if (!normalizedThings.some((thing) => thing !== "")) return;

    const today = inputDateRef.current;
    mutationRef.current = operation;
    clearSavedMessage();
    setSaveError("");
    setIsSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser().catch((error) => {
          if (current()) auth?.onOwnerMismatch(null);
          throw error;
        });

      if (!isCurrentOperation()) return;

      if (userError || !user || user.id !== displayedUserId) {
        auth?.onOwnerMismatch(userError ? null : user?.id ?? null);
        if (!isCurrentOperation()) return;
        console.error("ユーザー情報が取得できませんでした", userError);
        setSaveError(accountChangedMessage);
        return;
      }

      // 開始時に確定した対象日と文章で追加または更新する
      const { error: insertError } = await supabase
        .from("three_good_things")
        .upsert(
          {
            user_id: displayedUserId,
            date: today,
            things1: normalizedThings[0],
            things2: normalizedThings[1],
            things3: normalizedThings[2],
          },
          { onConflict: "user_id,date" },
        );

      if (!isCurrentOperation()) return;

      if (insertError) {
        console.error("保存エラー:", insertError);
        if (isMountedRef.current) {
          setSaveError("記録を保存できませんでした。もう一度お試しください。");
        }
        return;
      }

      removeThreeGoodThingsDraft(displayedUserId);
      savedThingsRef.current = normalizedThings;

      setThings(normalizedThings);
      setAllRecords((records) => ({ ...records, [today]: normalizedThings }));
      setSelectedDate(today);
      setIsSaved(true);
      setSaveError("");

      const timeout = setTimeout(() => {
        if (savedMessageTimeoutRef.current === timeout && isCurrentOperation()) {
          savedMessageTimeoutRef.current = null;
          setIsSaved(false);
        }
      }, 3000);
      savedMessageTimeoutRef.current = timeout;
    } catch (error) {
      if (isCurrentOperation()) {
        console.error("記録保存中の想定外のエラー:", error);
        setSaveError("記録を保存できませんでした。もう一度お試しください。");
      }
    } finally {
      if (mutationRef.current === operation) {
        if (isCurrentOperation()) setIsSaving(false);
        mutationRef.current = null;
      }
    }
  };

  const handleDelete = async (dateToDelete: string) => {
    const operation = Symbol();
    const current = capture();
    const displayedUserId = userIdRef.current;
    const authGeneration = authGenerationRef.current;
    const isCurrentOperation = () =>
      current() && isMountedRef.current &&
      (mutationRef.current === null || mutationRef.current === operation) &&
      authGenerationRef.current === authGeneration &&
      authUserIdRef.current === displayedUserId &&
      userIdRef.current === displayedUserId;
    if (
      !isCurrentOperation() ||
      mutationRef.current !== null ||
      !displayedUserId ||
      authUserIdRef.current !== displayedUserId ||
      isLoadingRecords
    ) return;

    if (!window.confirm(`${dateToDelete} の記録を削除してもよろしいですか？`))
      return;

    if (!isCurrentOperation() || mutationRef.current) return;
    mutationRef.current = operation;
    clearSavedMessage();
    setDeleteError("");
    setDeletingDate(dateToDelete);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser().catch((error) => {
          if (current()) auth?.onOwnerMismatch(null);
          throw error;
        });

      if (!isCurrentOperation()) return;

      if (userError || !user || user.id !== displayedUserId) {
        auth?.onOwnerMismatch(userError ? null : user?.id ?? null);
        if (!isCurrentOperation()) return;
        console.error("ユーザー情報が取得できませんでした", userError);
        setDeleteError(accountChangedMessage);
        return;
      }

      // 自分のその日の記録だけ削除する
      const { error } = await supabase
        .from("three_good_things")
        .delete()
        .eq("user_id", displayedUserId)
        .eq("date", dateToDelete);

      if (!isCurrentOperation()) return;

      if (error) {
        console.error("削除エラー:", error);
        setDeleteError("記録を削除できませんでした。もう一度お試しください。");
        return;
      }

      setAllRecords((currentRecords) => {
        const updatedRecords = { ...currentRecords };
        delete updatedRecords[dateToDelete];
        return updatedRecords;
      });

      if (dateToDelete === inputDateRef.current) {
        removeThreeGoodThingsDraft(displayedUserId);
        savedThingsRef.current = ["", "", ""];
        setThings(["", "", ""]);
        setDraftRestored(false);
      }

      setSelectedDate(null);
      setDeleteError("");
    } catch (error) {
      if (isCurrentOperation()) {
        console.error("記録削除中の想定外のエラー:", error);
        setDeleteError("記録を削除できませんでした。もう一度お試しください。");
      }
    } finally {
      if (mutationRef.current === operation) {
        if (isCurrentOperation()) setDeletingDate(null);
        mutationRef.current = null;
      }
    }
  };
  const isMutating = isSaving || deletingDate !== null;
  const past14Days = getPast14Days();
  const isDeletingSelectedDate =
    selectedDate !== null && deletingDate === selectedDate;
  const hasThingToSave = things.some((thing) => thing.trim() !== "");

  return (
    <div className="bg-white/80 backdrop-blur-sm p-6 rounded-[2rem] shadow-sm border border-pink-50 w-full mb-24 flex flex-col items-center">
      <h3 className="text-pink-700 font-bold mb-2">🌷 3つのよかったこと</h3>
      <p className="text-pink-600/80 text-xs text-center mb-6">
        今日あった、どんなに小さなことでも大丈夫。
        <br />
        よかったことや、感謝したいことを3つ書いてみましょう。
      </p>
      <p className="text-[0.65rem] text-pink-400 text-center -mt-3 mb-4">
        入力内容はこの端末に一時保存されます。
      </p>
      <p className="text-sm font-bold text-pink-700 mb-3">入力対象日：{inputDate}</p>
      {inputDate !== todayDate && (
        <div className="w-full mb-4 rounded-xl bg-pink-50 p-3 text-xs text-pink-700">
          <p role="status">日付が変わりました。入力中の内容は{inputDate}の記録です。</p>
          <p className="mt-2">ページを再読み込みすると、今日の入力へ戻ります。前日の未保存の文章は復元されません。</p>
          <button type="button" onClick={handleToday} disabled={isMutating || isLoadingRecords || !userId}
            className="mt-2 rounded-full border border-pink-300 px-4 py-2 disabled:opacity-50">
            今日の入力へ
          </button>
        </div>
      )}
      {draftRestored && (
        <p
          role="status"
          className="w-full mb-4 rounded-xl bg-pink-50/60 px-3 py-2 text-center text-xs text-pink-500"
        >
          この端末に一時保存した今日の入力を復元しました。
        </p>
      )}

      <div className="w-full flex flex-col gap-3 mb-6">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-start gap-2">
            <span className="text-pink-400 font-bold mt-2">{index + 1}.</span>
            <textarea
              aria-label={`${["1つ目", "2つ目", "3つ目"][index]}のよかったこと`}
              value={things[index]}
              onChange={(e) => handleChange(index, e.target.value)}
              disabled={isLoadingRecords || isMutating || !userId}
              placeholder={`（例：${["美味しいコーヒーを飲んだ", "天気が良くて気持ちよかった", "ゆっくり休めた"][index]}）`}
              className="w-full min-h-16 [field-sizing:content] bg-pink-50/50 border border-pink-100 rounded-xl p-3 text-sm text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-200 resize-none"
            />
          </div>
        ))}
      </div>

      <div className="relative w-full flex justify-center h-10 mb-4">
        <AnimatePresence mode="wait">
          {!isSaved ? (
            <motion.button
              type="button"
              key="save-button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onClick={handleSave}
              disabled={isMutating || isLoadingRecords || !userId || !hasThingToSave}
              className="bg-pink-700 hover:bg-pink-800 disabled:bg-pink-300 disabled:cursor-not-allowed text-white px-8 py-2 rounded-full font-bold transition-colors shadow-sm"
            >
              {isSaving ? "保存中..." : "記録する"}
            </motion.button>
          ) : (
            <motion.p
              role="status"
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
      {saveError && (
        <p
          role="alert"
          className="w-full mb-4 rounded-xl border border-red-100 bg-red-50/70 px-4 py-2 text-center text-xs font-bold text-red-500"
        >
          {saveError}
        </p>
      )}

      <div className="w-full bg-pink-50/30 rounded-xl p-4 flex flex-col items-center">
        <p className="text-[0.65rem] text-pink-400 font-bold mb-2">
          🌱 最近の記録（2週間）
        </p>
        {isLoadingRecords && !loadError ? (
          <p
            aria-live="polite"
            className="w-full mb-3 rounded-xl bg-white/60 px-3 py-2 text-center text-xs font-bold text-pink-400"
          >
            記録を読み込んでいます...
          </p>
        ) : loadError ? (
          <div role="alert" className="w-full mb-3 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2 text-center text-xs font-bold text-red-500">
            <p>{loadError}</p>
            <button type="button" onClick={() => { setIsLoadingRecords(true); void fetchRecords(); }} disabled={isLoadingRecords || isMutating} className="mt-2 rounded-full border border-red-200 bg-white px-4 py-2 disabled:opacity-60">
              {isLoadingRecords ? "再読み込み中..." : "3つのよかったことを再読み込み"}
            </button>
          </div>
        ) : null}
        {deleteError && (
          <p
            role="alert"
            className="w-full mb-3 rounded-xl border border-red-100 bg-red-50/60 px-3 py-2 text-center text-xs font-bold text-red-500"
          >
            {deleteError}
          </p>
        )}
        <div
          aria-label="最近2週間の記録"
          tabIndex={0}
          className="w-full max-w-full overflow-x-auto mb-2 rounded-md focus-visible:ring-2 focus-visible:ring-pink-300"
        >
          <div className="flex w-max gap-1 px-0.5 py-1">
            {past14Days.map((date) => {
            const hasRecord =
              allRecords[date] &&
              allRecords[date].some((text) => text.trim() !== "");
            const isSelected = selectedDate === date;

            return (
              <button
                key={date}
                type="button"
                title={date}
                aria-label={`${date}、${hasRecord ? `記録あり、詳細を${isSelected ? "閉じる" : "開く"}` : "記録なし"}`}
                aria-pressed={hasRecord ? isSelected : undefined}
                disabled={!hasRecord}
                onClick={() => {
                  if (hasRecord) {
                    setSelectedDate(isSelected ? null : date);
                  }
                }}
                className="group flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
              >
                <span
                  aria-hidden="true"
                  data-recorded={hasRecord ? "true" : "false"}
                  className={`good-thing-day h-4 w-4 rounded-[4px] transition-all ${
                    hasRecord
                      ? "bg-green-400 group-hover:bg-green-500 shadow-sm"
                      : "bg-gray-100"
                  } ${isSelected ? "ring-2 ring-pink-400 ring-offset-1 scale-110" : ""}`}
                />
              </button>
            );
            })}
          </div>
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
                  type="button"
                  aria-label={`${selectedDate} の記録を削除`}
                  onClick={() => handleDelete(selectedDate)}
                  disabled={isMutating || isLoadingRecords || !userId}
                  className={`p-1 text-pink-300 transition-colors hover:text-red-400 disabled:cursor-not-allowed disabled:hover:text-pink-300 ${
                    isDeletingSelectedDate ? "opacity-50" : ""
                  }`}
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
