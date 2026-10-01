const FAVORITE_AFFIRMATIONS_STORAGE_KEY_PREFIX = "favoriteAffirmations";
export const THREE_GOOD_THINGS_DRAFT_PREFIX =
  "daily-affirmation:three-good-things-draft:";

export function getFavoriteAffirmationsStorageKey(userId: string) {
  return `${FAVORITE_AFFIRMATIONS_STORAGE_KEY_PREFIX}:${userId}`;
}

export function getThreeGoodThingsDraftKey(userId: string) {
  return `${THREE_GOOD_THINGS_DRAFT_PREFIX}${encodeURIComponent(userId)}`;
}

export function hasUnsavedThreeGoodThingsDraft(userId: string) {
  try {
    const rawDraft = window.localStorage.getItem(
      getThreeGoodThingsDraftKey(userId),
    );
    if (!rawDraft) return false;

    const draft = JSON.parse(rawDraft) as { things?: unknown };
    return (
      Array.isArray(draft.things) &&
      draft.things.some(
        (thing) => typeof thing === "string" && thing.trim() !== "",
      )
    );
  } catch {
    return false;
  }
}

export function removeUserLocalData(userId: string) {
  const keys = [
    getFavoriteAffirmationsStorageKey(userId),
    getThreeGoodThingsDraftKey(userId),
  ];

  for (const key of keys) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // 片方を削除できなくても、もう片方の削除とログアウトは続けます。
    }
  }
}
