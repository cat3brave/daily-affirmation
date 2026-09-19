import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFavoriteAffirmations } from "./useFavoriteAffirmations";

type FavoriteSupabaseClient = Parameters<typeof useFavoriteAffirmations>[1];
type FavoriteRow = { text: string | null };
type SupabaseError = { message: string };
type FavoriteQueryResult = {
  data: FavoriteRow[] | null;
  error: SupabaseError | null;
};
type MutationResult = {
  error: SupabaseError | null;
};

const USER_ID = "user-1";
const SAVE_ERROR_MESSAGE =
  "お気に入りの保存に失敗しました。もう一度お試しください。";
const DELETE_ERROR_MESSAGE =
  "お気に入りの削除に失敗しました。もう一度お試しください。";

function createSupabaseMock({
  fetchedFavorites = [],
  insertError,
  insertResults,
  deleteError,
}: {
  fetchedFavorites?: string[];
  insertError?: Error;
  insertResults?: MutationResult[];
  deleteError?: Error;
} = {}) {
  const order = vi.fn<() => Promise<FavoriteQueryResult>>(async () => ({
    data: fetchedFavorites.map((text) => ({ text })),
    error: null,
  }));
  const selectEq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq: selectEq }));
  const insert = vi.fn<() => Promise<MutationResult>>(async () => {
    if (insertError) {
      throw insertError;
    }

    return insertResults?.shift() ?? { error: null };
  });
  const secondDeleteEq = vi.fn<() => Promise<MutationResult>>(async () => {
    if (deleteError) {
      throw deleteError;
    }

    return { error: null };
  });
  const firstDeleteEq = vi.fn(() => ({ eq: secondDeleteEq }));
  const deleteFavorite = vi.fn(() => ({ eq: firstDeleteEq }));
  const from = vi.fn(() => ({
    delete: deleteFavorite,
    insert,
    select,
  }));

  return {
    firstDeleteEq,
    from,
    insert,
    order,
    secondDeleteEq,
    supabase: { from } as unknown as FavoriteSupabaseClient,
  };
}

async function renderFavoriteHook(supabase: FavoriteSupabaseClient) {
  const hook = renderHook(() => useFavoriteAffirmations(USER_ID, supabase));

  await waitFor(() => {
    expect(supabase.from).toHaveBeenCalledWith("favorite_affirmations");
  });

  return hook;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("useFavoriteAffirmations", () => {
  it("Supabase取得成功時にfavoriteAffirmationsへ反映する", async () => {
    const { order, supabase } = createSupabaseMock({
      fetchedFavorites: ["朝の光", "深呼吸"],
    });

    const { result } = await renderFavoriteHook(supabase);

    await waitFor(() => {
      expect(result.current.favoriteAffirmations).toEqual([
        "朝の光",
        "深呼吸",
      ]);
    });
    expect(result.current.favoriteError).toBe("");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("既存のお気に入りを再保存しても重複insertせず一覧とエラー表示を保つ", async () => {
    const favorite = "朝の光";
    const { insert, supabase } = createSupabaseMock({
      fetchedFavorites: [favorite],
    });
    const { result } = await renderFavoriteHook(supabase);

    await waitFor(() => {
      expect(result.current.favoriteAffirmations).toEqual([favorite]);
    });

    await act(async () => {
      await result.current.handleFavoriteAffirmation(favorite);
    });

    expect(insert).not.toHaveBeenCalled();
    expect(result.current.favoriteAffirmations).toEqual([favorite]);
    expect(result.current.favoriteError).toBe("");
  });

  it("保存応答前に同じ言葉を続けて保存してもinsertは一度だけ実行する", async () => {
    let resolveInsert: ((result: MutationResult) => void) | undefined;
    const { insert, supabase } = createSupabaseMock();
    insert.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveInsert = resolve;
        }),
    );
    const { result } = await renderFavoriteHook(supabase);

    let firstSave: Promise<void>;
    await act(async () => {
      firstSave = result.current.handleFavoriteAffirmation("深呼吸する");
      await result.current.handleFavoriteAffirmation("深呼吸する");
    });

    expect(insert).toHaveBeenCalledTimes(1);
    expect(result.current.favoriteAffirmations).toEqual(["深呼吸する"]);

    await act(async () => {
      resolveInsert?.({ error: null });
      await firstSave!;
    });

    expect(result.current.favoriteError).toBe("");
  });

  it("新規保存が失敗した場合はロールバックし、同じ言葉を再試行できる", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { insert, supabase } = createSupabaseMock({
      insertResults: [
        { error: { message: "insert failed" } },
        { error: null },
      ],
    });
    const { result } = await renderFavoriteHook(supabase);

    await act(async () => {
      await result.current.handleFavoriteAffirmation("小さく進む");
    });
    expect(result.current.favoriteAffirmations).toEqual([]);
    expect(result.current.favoriteError).toBe(SAVE_ERROR_MESSAGE);

    await act(async () => {
      await result.current.handleFavoriteAffirmation("小さく進む");
    });

    expect(insert).toHaveBeenCalledTimes(2);
    expect(result.current.favoriteAffirmations).toEqual(["小さく進む"]);
    expect(result.current.favoriteError).toBe("");
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it("保存中に想定外の例外が発生した場合は追加したお気に入りをロールバックする", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { supabase } = createSupabaseMock({
      insertError: new Error("insert failed"),
    });
    const { result } = await renderFavoriteHook(supabase);

    await act(async () => {
      await result.current.handleFavoriteAffirmation("小さく進む");
    });

    await waitFor(() => {
      expect(result.current.favoriteAffirmations).not.toContain("小さく進む");
    });
    expect(result.current.favoriteError).toBe(SAVE_ERROR_MESSAGE);
    expect(consoleError).toHaveBeenCalled();
  });

  it("削除中に想定外の例外が発生した場合は消したお気に入りを一覧へ戻す", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const favorite = "今日はここまでで十分";
    const { supabase } = createSupabaseMock({
      deleteError: new Error("delete failed"),
      fetchedFavorites: [favorite],
    });
    const { result } = await renderFavoriteHook(supabase);

    await waitFor(() => {
      expect(result.current.favoriteAffirmations).toEqual([favorite]);
    });

    await act(async () => {
      await result.current.handleRemoveFavoriteAffirmation(favorite);
    });

    await waitFor(() => {
      expect(result.current.favoriteAffirmations).toEqual([favorite]);
    });
    expect(result.current.favoriteError).toBe(DELETE_ERROR_MESSAGE);
    expect(consoleError).toHaveBeenCalled();
  });

  it("localStorage.setItemが例外を投げても例外が伝播せずフックを使い続けられる", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage failed");
    });
    const { supabase } = createSupabaseMock();

    const { result } = await renderFavoriteHook(supabase);

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });

    let caughtError: unknown;
    await act(async () => {
      try {
        await result.current.handleFavoriteAffirmation("あと一歩");
      } catch (error) {
        caughtError = error;
      }
    });

    expect(caughtError).toBeUndefined();
    await waitFor(() => {
      expect(result.current.isFavorite("あと一歩")).toBe(true);
    });
    expect(consoleError).toHaveBeenCalled();
  });
});
