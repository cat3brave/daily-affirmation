export const THREE_GOOD_THINGS_DRAFT_PREFIX =
  "daily-affirmation:three-good-things-draft:";

type ThreeGoodThingsDraft = {
  date: string;
  things: string[];
};

export function getThreeGoodThingsDraftKey(userId: string) {
  return `${THREE_GOOD_THINGS_DRAFT_PREFIX}${encodeURIComponent(userId)}`;
}

function isThreeThings(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((thing) => typeof thing === "string")
  );
}

export function readThreeGoodThingsDraft(
  userId: string,
  today: string,
): string[] | null {
  try {
    const rawDraft = window.localStorage.getItem(
      getThreeGoodThingsDraftKey(userId),
    );
    if (!rawDraft) return null;

    const draft = JSON.parse(rawDraft) as Partial<ThreeGoodThingsDraft>;
    if (
      draft.date !== today ||
      !isThreeThings(draft.things) ||
      !draft.things.some((thing) => thing.trim() !== "")
    ) {
      removeThreeGoodThingsDraft(userId);
      return null;
    }

    return [...draft.things];
  } catch {
    removeThreeGoodThingsDraft(userId);
    return null;
  }
}

export function writeThreeGoodThingsDraft(
  userId: string,
  today: string,
  things: string[],
) {
  try {
    window.localStorage.setItem(
      getThreeGoodThingsDraftKey(userId),
      JSON.stringify({ date: today, things }),
    );
  } catch {
    // localStorage が利用できなくても、入力とオンライン保存は続けられます。
  }
}

export function removeThreeGoodThingsDraft(userId: string) {
  try {
    window.localStorage.removeItem(getThreeGoodThingsDraftKey(userId));
  } catch {
    // localStorage が利用できなくても、入力とオンライン保存は続けられます。
  }
}
