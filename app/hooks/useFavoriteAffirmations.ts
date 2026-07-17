import { useCallback, useEffect, useState } from "react";
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
  const [hasLoadedFavorites, setHasLoadedFavorites] = useState(false);

  useEffect(() => {
    setHasLoadedFavorites(false);
    setFavoriteAffirmations([]);
    setFavoriteError("");

    if (!userId) return;

    try {
      const savedFavorites = localStorage.getItem(
        getFavoriteAffirmationsStorageKey(userId),
      );

      if (savedFavorites) {
        const parsedFavorites = JSON.parse(savedFavorites);

        if (Array.isArray(parsedFavorites)) {
          setFavoriteAffirmations(
            parsedFavorites.filter(
              (favorite): favorite is string => typeof favorite === "string",
            ),
          );
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

  useEffect(() => {
    if (!userId || !hasLoadedFavorites) return;

    let isMounted = true;

    const fetchFavoriteAffirmations = async () => {
      try {
        const { data, error } = await supabase
          .from("favorite_affirmations")
          .select("text")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (!isMounted) return;

        if (error) {
          console.error(error);
          setFavoriteError(
            "お気に入りの読み込みに失敗しました。時間をおいて、もう一度お試しください。",
          );
          return;
        }

        setFavoriteError("");

        if (data) {
          const fetchedFavorites = data
            .map((favorite) => favorite.text)
            .filter((text): text is string => typeof text === "string");

          setFavoriteAffirmations(fetchedFavorites);
        }
      } catch (error) {
        console.error("お気に入り読み込み中の想定外エラー:", error);
        if (isMounted) {
          setFavoriteError(
            "お気に入りの読み込みに失敗しました。時間をおいて、もう一度お試しください。",
          );
        }
      }
    };

    fetchFavoriteAffirmations();

    return () => {
      isMounted = false;
    };
  }, [hasLoadedFavorites, supabase, userId]);

  const handleFavoriteAffirmation = useCallback(
    async (affirmationText: string) => {
      const favoriteText = affirmationText.trim();

      if (!favoriteText || !userId) return;

      setFavoriteError("");

      setFavoriteAffirmations((prev) => {
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
          setFavoriteAffirmations((prev) =>
            prev.filter((affirmation) => affirmation !== favoriteText),
          );
        }
      } catch (error) {
        console.error("お気に入り保存中の想定外エラー:", error);
        setFavoriteError(
          "お気に入りの保存に失敗しました。もう一度お試しください。",
        );
        setFavoriteAffirmations((prev) =>
          prev.filter((affirmation) => affirmation !== favoriteText),
        );
      }
    },
    [supabase, userId],
  );

  const handleRemoveFavoriteAffirmation = useCallback(
    async (affirmationToRemove: string) => {
      const removeText = affirmationToRemove.trim();

      if (!removeText || !userId) return;

      setFavoriteError("");

      setFavoriteAffirmations((prev) =>
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
          setFavoriteAffirmations((prev) => {
            if (prev.includes(removeText)) return prev;
            return [removeText, ...prev];
          });
        }
      } catch (error) {
        console.error("お気に入り削除中の想定外エラー:", error);
        setFavoriteError(
          "お気に入りの削除に失敗しました。もう一度お試しください。",
        );
        setFavoriteAffirmations((prev) => {
          if (prev.includes(removeText)) return prev;
          return [removeText, ...prev];
        });
      }
    },
    [supabase, userId],
  );

  const isFavorite = useCallback(
    (affirmationText: string) =>
      favoriteAffirmations.includes(affirmationText.trim()),
    [favoriteAffirmations],
  );

  return {
    favoriteAffirmations,
    favoriteError,
    handleFavoriteAffirmation,
    handleRemoveFavoriteAffirmation,
    isFavorite,
  };
}
