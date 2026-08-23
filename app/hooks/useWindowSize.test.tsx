import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWindowSize } from "./useWindowSize";

const originalInnerWidth = window.innerWidth;
const originalInnerHeight = window.innerHeight;

function setWindowSize(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: height,
  });
}

afterEach(() => {
  cleanup();
  setWindowSize(originalInnerWidth, originalInnerHeight);
  vi.restoreAllMocks();
});

describe("useWindowSize", () => {
  it("reflects the initial window dimensions after the effect runs", () => {
    setWindowSize(1280, 720);

    const { result } = renderHook(() => useWindowSize());

    expect(result.current.windowSize).toEqual({ width: 1280, height: 720 });
  });

  it("updates to the latest dimensions on resize", () => {
    setWindowSize(1024, 768);
    const { result } = renderHook(() => useWindowSize());

    setWindowSize(390, 844);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current.windowSize).toEqual({ width: 390, height: 844 });
  });

  it("removes the resize event listener when unmounted", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useWindowSize());
    const resizeListener = addEventListenerSpy.mock.calls.find(
      ([eventName]) => eventName === "resize",
    )?.[1];

    expect(resizeListener).toBeDefined();

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", resizeListener);
  });
});
