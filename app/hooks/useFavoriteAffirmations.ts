import { useDashboardOperation, verifyDashboardOwner } from "./dashboardAuth";
import { isAccountDeleted } from "../lib/deletedAccount";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { createSupabaseBrowserClient } from "../lib/supabaseClient";
import { getFavoriteAffirmationsStorageKey } from "../lib/userLocalStorage";

const subscribeToInitialCache = () => () => {};
const serverCache = () => undefined;

type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

export function useFavoriteAffirmations(
  userId: string | null,
  supabase: SupabaseBrowserClient,
) {
  const { capture, auth } = useDashboardOperation(userId);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [favoriteAffirmations, setFavoriteAffirmations] = useState<string[]>(
    [],
  );
  const [favoriteError, setFavoriteError] = useState("");
  const [favoriteLoadError, setFavoriteLoadError] = useState("");
  const [isReloadingFavorites, setIsReloadingFavorites] = useState(Boolean(userId));
  const [hasLoadedFavorites, setHasLoadedFavorites] = useState(false);
  const favoriteAffirmationsRef = useRef<string[]>([]);
  const pendingFavoriteAffirmationsRef = useRef(new Set<string>());
  const loadRequestRef = useRef(0);
  const loadInFlightRef = useRef(false);

  const updateFavoriteAffirmations = useCallback(
    (update: (favorites: string[]) => string[]) => {
      const next = update(favoriteAffirmationsRef.current);
      favoriteAffirmationsRef.current = next;
      setFavoriteAffirmations(next);
    },
    [],
  );

  const readInitialCache = useCallback(() => {
    try {
      return userId ? localStorage.getItem(getFavoriteAffirmationsStorageKey(userId)) : null;
    } catch {
      return null;
    }
  }, [userId]);
  const initialCache = useSyncExternalStore<string | null | undefined>(
    subscribeToInitialCache, readInitialCache, serverCache,
  );
  const [cacheOwner, setCacheOwner] = useState<{ id: string | null; ready: boolean }>({ id: userId, ready: false });
  // Reset owner-specific state before rendering a different user's data.
  // The server snapshot defers browser storage restoration until hydration.
  if (cacheOwner.id !== userId || (!cacheOwner.ready && initialCache !== undefined)) {
    const ready = initialCache !== undefined;
    let favorites: string[] = [];
    try {
      const parsed: unknown = initialCache ? JSON.parse(initialCache) : null;
      if (Array.isArray(parsed)) favorites = parsed.filter((value): value is string => typeof value === "string");
    } catch {
      console.error("お気に入りアファメーションの読み込みに失敗しました。");
    }
    setCacheOwner({ id: userId, ready });
    setFavoriteAffirmations(favorites);
    setLoadedOwner(ready ? userId : null);
    setHasLoadedFavorites(ready && Boolean(userId));
    setFavoriteError("");
    setFavoriteLoadError("");
    setIsReloadingFavorites(Boolean(userId));
  }

  useEffect(() => {
    favoriteAffirmationsRef.current = favoriteAffirmations;
  }, [favoriteAffirmations]);

  useEffect(() => {
    pendingFavoriteAffirmationsRef.current.clear();
    loadRequestRef.current += 1;
    loadInFlightRef.current = false;
  }, [userId]);

  useEffect(() => {
    if (!userId || loadedOwner !== userId || !hasLoadedFavorites || isAccountDeleted(userId) || !capture()()) return;

    try {
      localStorage.setItem(
        getFavoriteAffirmationsStorageKey(userId),
        JSON.stringify(favoriteAffirmations),
      );
    } catch {
      console.error("お気に入りアファメーションの保存に失敗しました。");
    }
  }, [favoriteAffirmations, hasLoadedFavorites, loadedOwner, userId, capture]);

  const loadFavoriteAffirmations = useCallback(() => {
      if (!userId || !hasLoadedFavorites || loadInFlightRef.current) return;
      const current = capture();
      if (!current()) return;
      const requestId = ++loadRequestRef.current;
      loadInFlightRef.current = true;
      return Promise.resolve(supabase
          .from("favorite_affirmations")
          .select("text")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })).then(({ data, error }) => {

        if (!current() || requestId !== loadRequestRef.current) return;

        if (error) {
          console.error(error);
          setFavoriteLoadError(
            "お気に入りの読み込みに失敗しました。時間をおいて、もう一度お試しください。",
          );
          return;
        }

        setFavoriteLoadError("");

        if (data) {
          const fetchedFavorites = data
            .map((favorite) => favorite.text)
            .filter((text): text is string => typeof text === "string");

          favoriteAffirmationsRef.current = fetchedFavorites;
          setFavoriteAffirmations(fetchedFavorites);
        }
      }).catch((error) => {
        if (!current()) return;
        console.error("お気に入り読み込み中の想定外エラー:", error);
        if (current() && requestId === loadRequestRef.current) {
          setFavoriteLoadError(
            "お気に入りの読み込みに失敗しました。時間をおいて、もう一度お試しください。",
          );
        }
      }).finally(() => {
        if (current() && requestId === loadRequestRef.current) {
          loadInFlightRef.current = false;
          setIsReloadingFavorites(false);
        }
      });
  }, [capture, hasLoadedFavorites, supabase, userId]);

  useEffect(() => {
    if (!userId || loadedOwner !== userId || !hasLoadedFavorites || isAccountDeleted(userId) || !capture()()) return;
    void loadFavoriteAffirmations();

    return () => {
      loadRequestRef.current += 1;
      loadInFlightRef.current = false;
    };
  }, [capture, loadFavoriteAffirmations, hasLoadedFavorites, loadedOwner, userId]);

  const fetchFavoriteAffirmations = useCallback(() => {
    if (!userId || !hasLoadedFavorites || !capture()() || loadInFlightRef.current) return;
    setIsReloadingFavorites(true);
    return loadFavoriteAffirmations();
  }, [capture, hasLoadedFavorites, loadFavoriteAffirmations, userId]);

  const handleFavoriteAffirmation = useCallback(
    async (affirmationText: string) => {
      const current = capture();
      if (!current()) return;
      const favoriteText = affirmationText.trim();

      if (!favoriteText || !userId || isAccountDeleted(userId)) return;
      if (
        favoriteAffirmationsRef.current.includes(favoriteText) ||
        pendingFavoriteAffirmationsRef.current.has(favoriteText)
      ) {
        return;
      }

      setFavoriteError("");
      pendingFavoriteAffirmationsRef.current.add(favoriteText);

      updateFavoriteAffirmations((prev) => {
        if (prev.includes(favoriteText)) return prev;
        return [favoriteText, ...prev];
      });

      try {
        if (!await verifyDashboardOwner(auth, supabase, userId, current)) return;
        const { error } = await supabase
          .from("favorite_affirmations")
          .insert({ user_id: userId, text: favoriteText });

        if (!current()) return;
        if (error) {
          console.error(error);
          setFavoriteError(
            "お気に入りの保存に失敗しました。もう一度お試しください。",
          );
          updateFavoriteAffirmations((prev) =>
            prev.filter((affirmation) => affirmation !== favoriteText),
          );
        }
      } catch (error) {
        if (!current()) return;
        console.error("お気に入り保存中の想定外エラー:", error);
        setFavoriteError(
          "お気に入りの保存に失敗しました。もう一度お試しください。",
        );
        updateFavoriteAffirmations((prev) =>
          prev.filter((affirmation) => affirmation !== favoriteText),
        );
      } finally {
        if (current()) pendingFavoriteAffirmationsRef.current.delete(favoriteText);
      }
    },
    [auth, capture, supabase, updateFavoriteAffirmations, userId],
  );

  const handleRemoveFavoriteAffirmation = useCallback(
    async (affirmationToRemove: string) => {
      const current = capture();
      if (!current()) return;
      const removeText = affirmationToRemove.trim();

      if (!removeText || !userId || isAccountDeleted(userId) || pendingFavoriteAffirmationsRef.current.has(removeText)) return;
      pendingFavoriteAffirmationsRef.current.add(removeText);

      setFavoriteError("");

      updateFavoriteAffirmations((prev) =>
        prev.filter((affirmation) => affirmation !== removeText),
      );

      try {
        if (!await verifyDashboardOwner(auth, supabase, userId, current)) return;
        const { error } = await supabase
          .from("favorite_affirmations")
          .delete()
          .eq("user_id", userId)
          .eq("text", removeText);

        if (!current()) return;
        if (error) {
          console.error(error);
          setFavoriteError(
            "お気に入りの削除に失敗しました。もう一度お試しください。",
          );
          updateFavoriteAffirmations((prev) => {
            if (prev.includes(removeText)) return prev;
            return [removeText, ...prev];
          });
        }
      } catch (error) {
        if (!current()) return;
        console.error("お気に入り削除中の想定外エラー:", error);
        setFavoriteError(
          "お気に入りの削除に失敗しました。もう一度お試しください。",
        );
        updateFavoriteAffirmations((prev) => {
          if (prev.includes(removeText)) return prev;
          return [removeText, ...prev];
        });
      } finally {
        if (current()) pendingFavoriteAffirmationsRef.current.delete(removeText);
      }
    },
    [auth, capture, supabase, updateFavoriteAffirmations, userId],
  );

  const isFavorite = useCallback(
    (affirmationText: string) =>
      favoriteAffirmations.includes(affirmationText.trim()),
    [favoriteAffirmations],
  );

  return {
    favoriteAffirmations,
    favoriteError,
    favoriteLoadError,
    isReloadingFavorites,
    reloadFavoriteAffirmations: fetchFavoriteAffirmations,
    handleFavoriteAffirmation,
    handleRemoveFavoriteAffirmation,
    isFavorite,
  };
}
