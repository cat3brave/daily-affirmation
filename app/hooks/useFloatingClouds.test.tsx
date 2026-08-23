import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFloatingClouds } from "./useFloatingClouds";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useFloatingClouds", () => {
  it("starts with no floating clouds", () => {
    const { result } = renderHook(() => useFloatingClouds());

    expect(result.current.floatingClouds).toEqual([]);
  });

  it("adds a cloud with stable text, position, and id", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000001",
    );
    vi.spyOn(Math, "random").mockReturnValueOnce(0.75).mockReturnValueOnce(0.25);
    const { result } = renderHook(() => useFloatingClouds());

    act(() => {
      result.current.handleFloatCloud("ゆっくり進めば大丈夫");
    });

    expect(result.current.floatingClouds).toEqual([
      {
        id: "00000000-0000-4000-8000-000000000001",
        text: "ゆっくり進めば大丈夫",
        x: 25,
        y: -325,
      },
    ]);
  });

  it("removes a cloud after 8000ms", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "00000000-0000-4000-8000-000000000002",
    );
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { result } = renderHook(() => useFloatingClouds());

    act(() => {
      result.current.handleFloatCloud("雲の言葉");
      vi.advanceTimersByTime(7999);
    });
    expect(result.current.floatingClouds).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.floatingClouds).toEqual([]);
  });

  it("manages multiple clouds independently", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000003")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000004");
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const { result } = renderHook(() => useFloatingClouds());

    act(() => {
      result.current.handleFloatCloud("最初の雲");
      vi.advanceTimersByTime(4000);
      result.current.handleFloatCloud("次の雲");
    });
    expect(result.current.floatingClouds.map(({ text }) => text)).toEqual([
      "最初の雲",
      "次の雲",
    ]);

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.floatingClouds.map(({ text }) => text)).toEqual([
      "次の雲",
    ]);

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current.floatingClouds).toEqual([]);
  });

  it("clears pending cloud timeouts when unmounted", () => {
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000005")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000006");
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const { result, unmount } = renderHook(() => useFloatingClouds());

    act(() => {
      result.current.handleFloatCloud("残っている雲1");
      result.current.handleFloatCloud("残っている雲2");
    });
    expect(vi.getTimerCount()).toBe(2);

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
