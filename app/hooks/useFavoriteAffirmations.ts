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
  const [hasLoadedFavorites, setHasLoadedFavorites] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasLoadedFavorites(false);
    setFavoriteAffirmations([]);

    if (!userId) return;

    const savedFavorites = localStorage.getItem(
      getFavoriteAffirmationsStorageKey(userId),
    );

    if (savedFavorites) {
      try {
        const parsedFavorites = JSON.parse(savedFavorites);

        if (Array.isArray(parsedFavorites)) {
          setFavoriteAffirmations(
            parsedFavorites.filter(
              (favorite): favorite is string => typeof favorite === "string",
            ),
          );
        }
      } catch {
        console.error("お気に入りアファメーションの読み込みに失敗しました。");
      }
    }

    setHasLoadedFavorites(true);
  }, [userId]);

  useEffect(() => {
    if (!userId || !hasLoadedFavorites) return;

    localStorage.setItem(
      getFavoriteAffirmationsStorageKey(userId),
      JSON.stringify(favoriteAffirmations),
    );
  }, [favoriteAffirmations, hasLoadedFavorites, userId]);

  useEffect(() => {
    if (!userId || !hasLoadedFavorites) return;

    let isMounted = true;

    const fetchFavoriteAffirmations = async () => {
      const { data, error } = await supabase
        .from("favorite_affirmations")
        .select("text")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (!isMounted) return;

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        const fetchedFavorites = data
          .map((favorite) => favorite.text)
          .filter((text): text is string => typeof text === "string");

        setFavoriteAffirmations(fetchedFavorites);
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

      setFavoriteAffirmations((prev) => {
        if (prev.includes(favoriteText)) return prev;
        return [favoriteText, ...prev];
      });

      const { error } = await supabase
        .from("favorite_affirmations")
        .insert({ user_id: userId, text: favoriteText });

      if (error) {
        console.error(error);
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

      setFavoriteAffirmations((prev) =>
        prev.filter((affirmation) => affirmation !== removeText),
      );

      const { error } = await supabase
        .from("favorite_affirmations")
        .delete()
        .eq("user_id", userId)
        .eq("text", removeText);

      if (error) {
        console.error(error);
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
    handleFavoriteAffirmation,
    handleRemoveFavoriteAffirmation,
    isFavorite,
  };
}
