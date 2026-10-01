import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFavoriteAffirmationsStorageKey,
  getThreeGoodThingsDraftKey,
  hasUnsavedThreeGoodThingsDraft,
  removeUserLocalData,
} from "./userLocalStorage";

describe("userLocalStorage", () => {
  beforeEach(() => window.localStorage.clear());

  it("既存形式のユーザー別キーを生成する", () => {
    expect(getFavoriteAffirmationsStorageKey("user/a")).toBe("favoriteAffirmations:user/a");
    expect(getThreeGoodThingsDraftKey("user/a")).toBe("daily-affirmation:three-good-things-draft:user%2Fa");
  });

  it("現在のユーザーの正確な2キーだけを削除する", () => {
    const currentKeys = [getFavoriteAffirmationsStorageKey("current"), getThreeGoodThingsDraftKey("current")];
    const keptKeys = [getFavoriteAffirmationsStorageKey("other"), getThreeGoodThingsDraftKey("other"), "unrelated"];
    [...currentKeys, ...keptKeys].forEach((key) => localStorage.setItem(key, "value"));
    removeUserLocalData("current");
    expect(currentKeys.map((key) => localStorage.getItem(key))).toEqual([null, null]);
    expect(keptKeys.map((key) => localStorage.getItem(key))).toEqual(["value", "value", "value"]);
  });

  it("空白ではない下書きだけを未保存下書きとして扱う", () => {
    const key = getThreeGoodThingsDraftKey("user");
    localStorage.setItem(key, JSON.stringify({ things: [" ", "\n", ""] }));
    expect(hasUnsavedThreeGoodThingsDraft("user")).toBe(false);
    localStorage.setItem(key, JSON.stringify({ things: ["", "よかったこと", ""] }));
    expect(hasUnsavedThreeGoodThingsDraft("user")).toBe(true);
  });

  it("localStorage例外を伝播させず両方の削除を試みる", () => {
    const removeItem = vi.spyOn(Storage.prototype, "removeItem");
    removeItem.mockImplementationOnce(() => { throw new DOMException("blocked", "SecurityError"); });
    expect(() => removeUserLocalData("user")).not.toThrow();
    expect(removeItem).toHaveBeenCalledTimes(2);
  });
});
