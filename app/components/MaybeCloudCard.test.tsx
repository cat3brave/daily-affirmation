import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MaybeCloudCard from "./MaybeCloudCard";

function renderMaybeCloudCard() {
  const handleFloatCloud = vi.fn<(text: string) => void>();
  render(<MaybeCloudCard handleFloatCloud={handleFloatCloud} />);

  return {
    button: screen.getByRole("button", { name: "放つ" }),
    handleFloatCloud,
    input: screen.getByRole("textbox"),
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("MaybeCloudCard", () => {
  it("空文字・空白だけでは放つがdisabledでcallbackを呼ばない", () => {
    const { button, handleFloatCloud, input } = renderMaybeCloudCard();

    expect(button).toBeDisabled();

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(handleFloatCloud).not.toHaveBeenCalled();
  });

  it("ボタンクリックでhandleFloatCloudへ入力を渡し入力欄を空にする", () => {
    const { button, handleFloatCloud, input } = renderMaybeCloudCard();

    fireEvent.change(input, { target: { value: "絶対に嫌われた" } });
    fireEvent.click(button);

    expect(handleFloatCloud).toHaveBeenCalledWith("絶対に嫌われた");
    expect(input).toHaveValue("");
  });

  it("Enterキーでも同じ処理を行う", () => {
    const { handleFloatCloud, input } = renderMaybeCloudCard();

    fireEvent.change(input, { target: { value: "絶対に失敗する" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(handleFloatCloud).toHaveBeenCalledWith("絶対に失敗する");
    expect(input).toHaveValue("");
  });

  it("空の状態でEnterを押してもcallbackを呼ばない", () => {
    const { handleFloatCloud, input } = renderMaybeCloudCard();

    fireEvent.keyDown(input, { key: "Enter" });

    expect(handleFloatCloud).not.toHaveBeenCalled();
  });
});
