import { useCallback, useEffect, useRef, useState } from "react";
import type { createSupabaseBrowserClient } from "../lib/supabaseClient";

const FAVORITE_AFFIRMATIONS_STORAGE_KEY_PREFIX = "favoriteAffirmations";

type SupabaseBrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

const getFavoriteAffirmationsStorageKey = (userId: string) =>
  `${FAVORITE_AFFIRMATIONS_STORAGE_KEY_PREFIX}:${userId}`;

export function useFavoriteAffirmations(
  userId: string | null,
  supabase: SupabaseBrowserClient,
) {
  const [favoriteAffirmations, setFavoriteAffirmations] = useState<string[]>(
    [],
  );
  const [favoriteError, setFavoriteError] = useState("");
  const [favoriteLoadError, setFavoriteLoadError] = useState("");
  const [isReloadingFavorites, setIsReloadingFavorites] = useState(false);
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

  useEffect(() => {
    setHasLoadedFavorites(false);
    setFavoriteAffirmations([]);
    favoriteAffirmationsRef.current = [];
    pendingFavoriteAffirmationsRef.current.clear();
    setFavoriteError("");
    setFavoriteLoadError("");
    loadRequestRef.current += 1;
    loadInFlightRef.current = false;

    if (!userId) return;

    try {
      const savedFavorites = localStorage.getItem(
        getFavoriteAffirmationsStorageKey(userId),
      );

      if (savedFavorites) {
        const parsedFavorites = JSON.parse(savedFavorites);

        if (Array.isArray(parsedFavorites)) {
          const favorites = parsedFavorites.filter(
            (favorite): favorite is string => typeof favorite === "string",
          );
          favoriteAffirmationsRef.current = favorites;
          setFavoriteAffirmations(favorites);
        }
      }
    } catch (error) {
      console.error(
        "お気に入りアファメーションの読み込みに失敗しました。",
        error,
      );
    } finally {
      setHasLoadedFavorites(true);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || !hasLoadedFavorites) return;

    try {
      localStorage.setItem(
        getFavoriteAffirmationsStorageKey(userId),
        JSON.stringify(favoriteAffirmations),
      );
    } catch (error) {
      console.error(
        "お気に入りアファメーションの保存に失敗しました。",
        error,
      );
    }
  }, [favoriteAffirmations, hasLoadedFavorites, userId]);

  const fetchFavoriteAffirmations = useCallback(async () => {
      if (!userId || !hasLoadedFavorites || loadInFlightRef.current) return;
      const requestId = ++loadRequestRef.current;
      loadInFlightRef.current = true;
      setIsReloadingFavorites(true);
      try {
        const { data, error } = await supabase
          .from("favorite_affirmations")
          .select("text")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (requestId !== loadRequestRef.current) return;

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
      } catch (error) {
        console.error("お気に入り読み込み中の想定外エラー:", error);
        if (requestId === loadRequestRef.current) {
          setFavoriteLoadError(
            "お気に入りの読み込みに失敗しました。時間をおいて、もう一度お試しください。",
          );
        }
      } finally {
        if (requestId === loadRequestRef.current) {
          loadInFlightRef.current = false;
          setIsReloadingFavorites(false);
        }
      }
  }, [hasLoadedFavorites, supabase, userId]);

  useEffect(() => {
    if (!userId || !hasLoadedFavorites) return;
    fetchFavoriteAffirmations();

    return () => {
      loadRequestRef.current += 1;
      loadInFlightRef.current = false;
    };
  }, [fetchFavoriteAffirmations, hasLoadedFavorites, userId]);

  const handleFavoriteAffirmation = useCallback(
    async (affirmationText: string) => {
      const favoriteText = affirmationText.trim();

      if (!favoriteText || !userId) return;
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
        const { error } = await supabase
          .from("favorite_affirmations")
          .insert({ user_id: userId, text: favoriteText });

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
        console.error("お気に入り保存中の想定外エラー:", error);
        setFavoriteError(
          "お気に入りの保存に失敗しました。もう一度お試しください。",
        );
        updateFavoriteAffirmations((prev) =>
          prev.filter((affirmation) => affirmation !== favoriteText),
        );
      } finally {
        pendingFavoriteAffirmationsRef.current.delete(favoriteText);
      }
    },
    [supabase, updateFavoriteAffirmations, userId],
  );

  const handleRemoveFavoriteAffirmation = useCallback(
    async (affirmationToRemove: string) => {
      const removeText = affirmationToRemove.trim();

      if (!removeText || !userId) return;

      setFavoriteError("");

      updateFavoriteAffirmations((prev) =>
        prev.filter((affirmation) => affirmation !== removeText),
      );

      try {
        const { error } = await supabase
          .from("favorite_affirmations")
          .delete()
          .eq("user_id", userId)
          .eq("text", removeText);

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
        console.error("お気に入り削除中の想定外エラー:", error);
        setFavoriteError(
          "お気に入りの削除に失敗しました。もう一度お試しください。",
        );
        updateFavoriteAffirmations((prev) => {
          if (prev.includes(removeText)) return prev;
          return [removeText, ...prev];
        });
      }
    },
    [supabase, updateFavoriteAffirmations, userId],
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
