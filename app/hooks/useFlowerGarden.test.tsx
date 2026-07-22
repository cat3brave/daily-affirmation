import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFlowerGarden } from "./useFlowerGarden";

type FlowerGardenSupabaseClient = Parameters<typeof useFlowerGarden>[1];
type SupabaseError = { message: string };
type CountResult = {
  count: number | null;
  error: SupabaseError | null;
};
type MutationResult = {
  error: SupabaseError | null;
};
type BloomInsert = {
  user_id: string;
  flower_type: string;
};
type FlowerGardenHookResult = {
  current: ReturnType<typeof useFlowerGarden>;
};

const USER_ID = "user-1";
const COUNT_ERROR_MESSAGE =
  "\u304a\u82b1\u306e\u8a18\u9332\u3092\u8aad\u307f\u8fbc\u3081\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u6642\u9593\u3092\u304a\u3044\u3066\u3001\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002";
const SAVE_ERROR_MESSAGE =
  "\u304a\u82b1\u306e\u8a18\u9332\u3092\u4fdd\u5b58\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002";

function createSupabaseMock({
  count = 0,
  countError,
  countException,
  insertError,
  insertException,
}: {
  count?: number;
  countError?: SupabaseError;
  countException?: Error;
  insertError?: SupabaseError;
  insertException?: Error;
} = {}) {
  const eq = vi.fn<(column: string, value: string) => Promise<CountResult>>(
    async () => {
      if (countException) {
        throw countException;
      }

      return { count, error: countError ?? null };
    },
  );
  const select = vi.fn<
    (
      columns: string,
      options: { count: "exact"; head: true },
    ) => { eq: typeof eq }
  >(() => ({ eq }));
  const insert = vi.fn<(values: BloomInsert) => Promise<MutationResult>>(
    async () => {
      if (insertException) {
        throw insertException;
      }

      return { error: insertError ?? null };
    },
  );
  const from = vi.fn(() => ({ insert, select }));

  return {
    eq,
    from,
    insert,
    select,
    supabase: { from } as unknown as FlowerGardenSupabaseClient,
  };
}

async function renderFlowerGardenHook(supabase: FlowerGardenSupabaseClient) {
  const hook = renderHook(() => useFlowerGarden(USER_ID, supabase));

  await waitFor(() => {
    expect(supabase.from).toHaveBeenCalledWith("bloom_logs");
  });

  return hook;
}

async function waitForInitialBloomFetch(
  eq: ReturnType<typeof createSupabaseMock>["eq"],
) {
  await waitFor(() => {
    expect(eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
}

async function advanceToAlmostBloom(result: FlowerGardenHookResult) {
  for (let growth = 1; growth <= 3; growth += 1) {
    await act(async () => {
      await result.current.handleWalk();
    });

    expect(result.current.growth).toBe(growth);
  }
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useFlowerGarden", () => {
  it("reflects the bloom count fetched from Supabase in totalBlooms", async () => {
    const { eq, select, supabase } = createSupabaseMock({ count: 7 });

    const { result } = await renderFlowerGardenHook(supabase);

    await waitFor(() => {
      expect(result.current.totalBlooms).toBe(7);
    });
    expect(supabase.from).toHaveBeenCalledWith("bloom_logs");
    expect(select).toHaveBeenCalledWith("*", { count: "exact", head: true });
    expect(eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(result.current.flowerError).toBe("");
  });

  it("advances the flower state and refresh key only when bloom saving succeeds", async () => {
    const expectedFlower = "🌸";
    const random = vi.spyOn(Math, "random").mockReturnValue(0.4);
    const { eq, insert, supabase } = createSupabaseMock();
    const { result } = await renderFlowerGardenHook(supabase);
    await waitForInitialBloomFetch(eq);

    await advanceToAlmostBloom(result);

    await act(async () => {
      await result.current.handleWalk();
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        flower_type: expectedFlower,
        user_id: USER_ID,
      }),
    );
    expect(result.current.growth).toBe(4);
    expect(result.current.currentFlower).toBe(expectedFlower);
    expect(result.current.totalBlooms).toBe(1);
    expect(result.current.bloomRefreshKey).toBe(1);
    expect(result.current.flowerError).toBe("");
    expect(result.current.isBloomSaving).toBe(false);
    expect(random).toHaveBeenCalled();
  });

  it("does not confirm a bloom when Supabase returns a save error", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.spyOn(Math, "random").mockReturnValue(0.4);
    const { eq, supabase } = createSupabaseMock({
      insertError: { message: "insert failed" },
    });
    const { result } = await renderFlowerGardenHook(supabase);
    await waitForInitialBloomFetch(eq);

    await advanceToAlmostBloom(result);

    await act(async () => {
      await result.current.handleWalk();
    });

    expect(result.current.growth).toBe(3);
    expect(result.current.totalBlooms).toBe(0);
    expect(result.current.bloomRefreshKey).toBe(0);
    expect(result.current.flowerError).toBe(SAVE_ERROR_MESSAGE);
    expect(result.current.isBloomSaving).toBe(false);
    expect(consoleError).toHaveBeenCalled();
  });

  it("keeps state stable when an unexpected exception occurs while saving", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.spyOn(Math, "random").mockReturnValue(0.4);
    const { eq, supabase } = createSupabaseMock({
      insertException: new Error("insert exploded"),
    });
    const { result } = await renderFlowerGardenHook(supabase);
    await waitForInitialBloomFetch(eq);

    await advanceToAlmostBloom(result);

    let caughtError: unknown;
    await act(async () => {
      try {
        await result.current.handleWalk();
      } catch (error) {
        caughtError = error;
      }
    });

    expect(caughtError).toBeUndefined();
    expect(result.current.growth).toBe(3);
    expect(result.current.totalBlooms).toBe(0);
    expect(result.current.bloomRefreshKey).toBe(0);
    expect(result.current.flowerError).toBe(SAVE_ERROR_MESSAGE);
    expect(result.current.isBloomSaving).toBe(false);
    expect(consoleError).toHaveBeenCalled();
  });

  it("shows a loading error when bloom total fetching throws unexpectedly", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { supabase } = createSupabaseMock({
      countException: new Error("count exploded"),
    });
    const { result } = await renderFlowerGardenHook(supabase);

    await waitFor(() => {
      expect(result.current.flowerError).toBe(COUNT_ERROR_MESSAGE);
    });
    expect(result.current.totalBlooms).toBe(0);
    expect(consoleError).toHaveBeenCalled();
  });
});
