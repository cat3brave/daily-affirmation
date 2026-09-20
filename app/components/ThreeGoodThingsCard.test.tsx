import type { ComponentProps } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MotionProps<Element extends "button" | "div" | "p"> =
  ComponentProps<Element> & {
    animate?: unknown;
    exit?: unknown;
    initial?: unknown;
  };

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    button: ({ animate, exit, initial, ...props }: MotionProps<"button">) => {
      void animate;
      void exit;
      void initial;
      return <button {...props} />;
    },
    div: ({ animate, exit, initial, ...props }: MotionProps<"div">) => {
      void animate;
      void exit;
      void initial;
      return <div {...props} />;
    },
    p: ({ animate, exit, initial, ...props }: MotionProps<"p">) => {
      void animate;
      void exit;
      void initial;
      return <p {...props} />;
    },
  },
}));

type SupabaseError = { message: string };
type UserResult = {
  data: {
    user: {
      id: string;
    } | null;
  };
  error: SupabaseError | null;
};
type ThreeGoodThingsRow = {
  date: string;
  things1: string | null;
  things2: string | null;
  things3: string | null;
};
type SelectResult = {
  data: ThreeGoodThingsRow[] | null;
  error: SupabaseError | null;
};
type MutationResult = {
  error: SupabaseError | null;
};
type UpsertValues = {
  date: string;
  things1: string;
  things2: string;
  things3: string;
  user_id: string;
};
type UpsertOptions = {
  onConflict: "user_id,date";
};

const supabaseMocks = vi.hoisted(() => {
  const getUser = vi.fn<() => Promise<UserResult>>();
  const selectEq = vi.fn<
    (column: string, value: string) => Promise<SelectResult>
  >();
  const select = vi.fn<(columns: string) => { eq: typeof selectEq }>();
  const upsert = vi.fn<
    (values: UpsertValues, options: UpsertOptions) => Promise<MutationResult>
  >();
  const deleteDateEq = vi.fn<
    (column: string, value: string) => Promise<MutationResult>
  >();
  const deleteUserEq = vi.fn<
    (column: string, value: string) => { eq: typeof deleteDateEq }
  >();
  const deleteRecord = vi.fn<() => { eq: typeof deleteUserEq }>();
  const from = vi.fn<
    (table: string) => {
      delete: typeof deleteRecord;
      select: typeof select;
      upsert: typeof upsert;
    }
  >();
  const createSupabaseBrowserClient = vi.fn(() => ({
    auth: { getUser },
    from,
  }));

  return {
    createSupabaseBrowserClient,
    deleteDateEq,
    deleteRecord,
    deleteUserEq,
    from,
    getUser,
    select,
    selectEq,
    upsert,
  };
});

vi.mock("../lib/supabaseClient", () => ({
  createSupabaseBrowserClient: supabaseMocks.createSupabaseBrowserClient,
}));

import ThreeGoodThingsCard from "./ThreeGoodThingsCard";
import { getThreeGoodThingsDraftKey } from "../lib/threeGoodThingsDraft";

const USER_ID = "user-three-good-1";
const LOAD_ERROR_MESSAGE =
  "記録を読み込めませんでした。時間をおいて、もう一度お試しください。";
const SAVE_ERROR_MESSAGE =
  "記録を保存できませんでした。もう一度お試しください。";
const DELETE_ERROR_MESSAGE =
  "記録を削除できませんでした。もう一度お試しください。";
const LOADING_MESSAGE = "記録を読み込んでいます...";

function createUserResult(userId = USER_ID): UserResult {
  return {
    data: {
      user: {
        id: userId,
      },
    },
    error: null,
  };
}

function createSelectResult(data: ThreeGoodThingsRow[] = []): SelectResult {
  return {
    data,
    error: null,
  };
}

function getTodayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function configureSupabaseMock({
  deleteException,
  getUserException,
  selectResult = createSelectResult(),
  upsertException,
}: {
  deleteException?: Error;
  getUserException?: Error;
  selectResult?: SelectResult;
  upsertException?: Error;
} = {}) {
  supabaseMocks.createSupabaseBrowserClient.mockReset();
  supabaseMocks.getUser.mockReset();
  supabaseMocks.from.mockReset();
  supabaseMocks.select.mockReset();
  supabaseMocks.selectEq.mockReset();
  supabaseMocks.upsert.mockReset();
  supabaseMocks.deleteRecord.mockReset();
  supabaseMocks.deleteUserEq.mockReset();
  supabaseMocks.deleteDateEq.mockReset();

  supabaseMocks.createSupabaseBrowserClient.mockReturnValue({
    auth: { getUser: supabaseMocks.getUser },
    from: supabaseMocks.from,
  });
  supabaseMocks.getUser.mockImplementation(async () => {
    if (getUserException) {
      throw getUserException;
    }

    return createUserResult();
  });
  supabaseMocks.from.mockReturnValue({
    delete: supabaseMocks.deleteRecord,
    select: supabaseMocks.select,
    upsert: supabaseMocks.upsert,
  });
  supabaseMocks.select.mockReturnValue({ eq: supabaseMocks.selectEq });
  supabaseMocks.selectEq.mockResolvedValue(selectResult);
  supabaseMocks.upsert.mockImplementation(async () => {
    if (upsertException) {
      throw upsertException;
    }

    return { error: null };
  });
  supabaseMocks.deleteRecord.mockReturnValue({ eq: supabaseMocks.deleteUserEq });
  supabaseMocks.deleteUserEq.mockReturnValue({ eq: supabaseMocks.deleteDateEq });
  supabaseMocks.deleteDateEq.mockImplementation(async () => {
    if (deleteException) {
      throw deleteException;
    }

    return { error: null };
  });
}

async function renderLoadedCard() {
  render(<ThreeGoodThingsCard />);

  await waitFor(() => {
    expect(screen.queryByText(LOADING_MESSAGE)).not.toBeInTheDocument();
  });
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  configureSupabaseMock();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ThreeGoodThingsCard", () => {
  it("タブ移動で再マウントしても未保存の入力を復元する", async () => {
    const firstRender = render(<ThreeGoodThingsCard />);
    await waitFor(() => {
      expect(screen.queryByText(LOADING_MESSAGE)).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "途中まで書いたよかったこと" },
    });
    firstRender.unmount();

    await renderLoadedCard();
    expect(screen.getAllByRole("textbox")[0]).toHaveValue(
      "途中まで書いたよかったこと",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "この端末に一時保存した今日の入力を復元しました。",
    );
  });

  it("今日の有効な下書きを保存済みデータより優先して復元する", async () => {
    const today = getTodayDate();
    window.localStorage.setItem(
      getThreeGoodThingsDraftKey(USER_ID),
      JSON.stringify({ date: today, things: ["下書き", "", ""] }),
    );
    configureSupabaseMock({
      selectResult: createSelectResult([
        {
          date: today,
          things1: "保存済み",
          things2: "保存済み2",
          things3: "保存済み3",
        },
      ]),
    });

    await renderLoadedCard();

    expect(screen.getAllByRole("textbox")[0]).toHaveValue("下書き");
    expect(screen.getByRole("status")).toHaveTextContent("復元しました");
  });

  it.each([
    ["別ユーザー", getThreeGoodThingsDraftKey("another-user"), () => ({ date: getTodayDate(), things: ["別ユーザーの下書き", "", ""] })],
    ["過去日", getThreeGoodThingsDraftKey(USER_ID), () => ({ date: "2000-01-01", things: ["古い下書き", "", ""] })],
    ["形式不正", getThreeGoodThingsDraftKey(USER_ID), () => ({ date: getTodayDate(), things: ["2要素", "だけ"] })],
    ["空白だけ", getThreeGoodThingsDraftKey(USER_ID), () => ({ date: getTodayDate(), things: [" ", "\n", "\t"] })],
  ])("%sの下書きを復元しない", async (_label, key, createDraft) => {
    window.localStorage.setItem(key, JSON.stringify(createDraft()));

    await renderLoadedCard();

    screen.getAllByRole("textbox").forEach((input) =>
      expect(input).toHaveValue(""),
    );
    expect(screen.queryByText(/今日の入力を復元しました/)).not.toBeInTheDocument();
  });

  it("保存済みデータを読み込んだだけでは下書きを作らない", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    configureSupabaseMock({
      selectResult: createSelectResult([
        { date: getTodayDate(), things1: "保存済み", things2: "", things3: "" },
      ]),
    });

    await renderLoadedCard();

    expect(setItem).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(getThreeGoodThingsDraftKey(USER_ID))).toBeNull();
  });

  it("入力変更で下書きを保存し、保存済み状態へ戻すと削除する", async () => {
    const today = getTodayDate();
    configureSupabaseMock({
      selectResult: createSelectResult([
        { date: today, things1: "保存済み", things2: "", things3: "" },
      ]),
    });
    await renderLoadedCard();
    const firstInput = screen.getAllByRole("textbox")[0];

    fireEvent.change(firstInput, { target: { value: "編集中" } });
    expect(JSON.parse(window.localStorage.getItem(getThreeGoodThingsDraftKey(USER_ID)) ?? "null")).toEqual({
      date: today,
      things: ["編集中", "", ""],
    });

    fireEvent.change(firstInput, { target: { value: "保存済み" } });
    expect(window.localStorage.getItem(getThreeGoodThingsDraftKey(USER_ID))).toBeNull();
  });

  it("空または空白だけの入力では保存できず、文字を入力すると保存できる", async () => {
    await renderLoadedCard();
    const inputs = screen.getAllByRole("textbox");
    const saveButton = screen.getByRole("button", { name: "記録する" });

    expect(saveButton).toBeDisabled();

    fireEvent.change(inputs[0], { target: { value: "  \n " } });
    expect(saveButton).toBeDisabled();

    supabaseMocks.getUser.mockClear();
    supabaseMocks.from.mockClear();
    fireEvent.click(saveButton);
    expect(supabaseMocks.getUser).not.toHaveBeenCalled();
    expect(supabaseMocks.from).not.toHaveBeenCalled();
    expect(supabaseMocks.upsert).not.toHaveBeenCalled();

    fireEvent.change(inputs[1], { target: { value: "うれしいこと" } });
    expect(saveButton).toBeEnabled();
  });

  it("記録ボタンに高コントラストの背景色を使用する", async () => {
    await renderLoadedCard();

    expect(screen.getByRole("button", { name: "記録する" })).toHaveClass(
      "bg-pink-700",
    );
  });
  it("表示ラベルで3つの入力欄を取得できる", async () => {
    await renderLoadedCard();

    expect(
      screen.getByRole("textbox", { name: "1つ目のよかったこと" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "2つ目のよかったこと" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "3つ目のよかったこと" }),
    ).toBeInTheDocument();
  });

  it("日付の記録状態と詳細の開閉状態を操作ボタンで伝える", async () => {
    const today = getTodayDate();
    configureSupabaseMock({
      selectResult: createSelectResult([
        {
          date: today,
          things1: "朝日がきれいだった",
          things2: "昼食がおいしかった",
          things3: "ゆっくり休めた",
        },
      ]),
    });
    await renderLoadedCard();

    const saveButton = screen.getByRole("button", { name: "記録する" });
    const recordedDateButton = screen.getByRole("button", {
      name: `${today}、記録あり、詳細を開く`,
    });
    const emptyDateButtons = screen.getAllByRole("button", {
      name: /記録なし/,
    });

    expect(saveButton).toHaveAttribute("type", "button");
    expect(recordedDateButton).toHaveAttribute("type", "button");
    expect(recordedDateButton).toHaveAttribute("aria-pressed", "false");
    emptyDateButtons.forEach((button) => {
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("type", "button");
    });

    fireEvent.click(recordedDateButton);

    const openDateButton = screen.getByRole("button", {
      name: `${today}、記録あり、詳細を閉じる`,
    });
    expect(openDateButton).toHaveAttribute("aria-pressed", "true");
    const deleteButton = screen.getByRole("button", {
      name: `${today} の記録を削除`,
    });
    expect(deleteButton).toHaveAttribute("type", "button");

    fireEvent.click(openDateButton);

    expect(
      screen.getByRole("button", {
        name: `${today}、記録あり、詳細を開く`,
      }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("取得成功時に今日の記録を入力欄と詳細へ表示する", async () => {
    const today = getTodayDate();
    const firstThing = "朝ごはんをゆっくり食べた";
    const secondThing = "仕事がひとつ片付いた";
    const thirdThing = "夜に深呼吸できた";
    configureSupabaseMock({
      selectResult: createSelectResult([
        {
          date: today,
          things1: firstThing,
          things2: secondThing,
          things3: thirdThing,
        },
      ]),
    });

    await renderLoadedCard();
    const inputs = screen.getAllByRole("textbox");

    expect(inputs[0]).toHaveValue(firstThing);
    expect(inputs[1]).toHaveValue(secondThing);
    expect(inputs[2]).toHaveValue(thirdThing);
    expect(supabaseMocks.from).toHaveBeenCalledWith("three_good_things");
    expect(supabaseMocks.select).toHaveBeenCalledWith("*");
    expect(supabaseMocks.selectEq).toHaveBeenCalledWith("user_id", USER_ID);

    fireEvent.click(screen.getByTitle(today));

    expect(
      await screen.findByText(`📅 ${today} のよかったこと`),
    ).toBeInTheDocument();
    const detailItems = screen.getAllByRole("listitem");
    expect(detailItems).toHaveLength(3);
    expect(detailItems[0]).toHaveTextContent(firstThing);
    expect(detailItems[1]).toHaveTextContent(secondThing);
    expect(detailItems[2]).toHaveTextContent(thirdThing);
  });

  it("保存成功時に入力内容を保存して成功メッセージと詳細へ表示する", async () => {
    const today = getTodayDate();
    const firstThing = "朝の散歩が気持ちよかった";
    const secondThing = "お昼をおいしく食べた";
    const thirdThing = "読みたかった本を開けた";
    await renderLoadedCard();
    const inputs = screen.getAllByRole("textbox");

    fireEvent.change(inputs[0], { target: { value: firstThing } });
    fireEvent.change(inputs[1], { target: { value: secondThing } });
    fireEvent.change(inputs[2], { target: { value: thirdThing } });
    expect(
      window.localStorage.getItem(getThreeGoodThingsDraftKey(USER_ID)),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "記録する" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "✨ 保存しました！今日もお疲れ様です ✨",
    );
    expect(supabaseMocks.upsert).toHaveBeenCalledWith(
      {
        date: today,
        things1: firstThing,
        things2: secondThing,
        things3: thirdThing,
        user_id: USER_ID,
      },
      { onConflict: "user_id,date" },
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(inputs[0]).toHaveValue(firstThing);
    expect(inputs[1]).toHaveValue(secondThing);
    expect(inputs[2]).toHaveValue(thirdThing);
    expect(
      window.localStorage.getItem(getThreeGoodThingsDraftKey(USER_ID)),
    ).toBeNull();

    expect(screen.getByText(`📅 ${today} のよかったこと`)).toBeInTheDocument();
    const detailItems = screen.getAllByRole("listitem");
    expect(detailItems).toHaveLength(3);
    expect(detailItems[0]).toHaveTextContent(firstThing);
    expect(detailItems[1]).toHaveTextContent(secondThing);
    expect(detailItems[2]).toHaveTextContent(thirdThing);
  });

  it("保存中は入力を固定し、正規化した部分入力を保存後の入力欄と履歴へ反映する", async () => {
    const today = getTodayDate();
    let finishUpsert: ((result: MutationResult) => void) | undefined;
    supabaseMocks.upsert.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishUpsert = resolve;
        }),
    );
    await renderLoadedCard();
    const inputs = screen.getAllByRole("textbox");

    fireEvent.change(inputs[0], {
      target: { value: "  朝の散歩が気持ちよかった  " },
    });
    fireEvent.change(inputs[1], { target: { value: " \n  " } });
    fireEvent.click(screen.getByRole("button", { name: "記録する" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "保存中..." })).toBeDisabled();
    });
    inputs.forEach((input) => expect(input).toBeDisabled());
    expect(supabaseMocks.upsert).toHaveBeenCalledWith(
      {
        date: today,
        things1: "朝の散歩が気持ちよかった",
        things2: "",
        things3: "",
        user_id: USER_ID,
      },
      { onConflict: "user_id,date" },
    );

    finishUpsert?.({ error: null });

    expect(await screen.findByRole("status")).toHaveTextContent(
      "✨ 保存しました！今日もお疲れ様です ✨",
    );
    expect(inputs[0]).toHaveValue("朝の散歩が気持ちよかった");
    expect(inputs[1]).toHaveValue("");
    expect(inputs[2]).toHaveValue("");
    expect(screen.getByText(`📅 ${today} のよかったこと`)).toBeInTheDocument();
    const detailItems = screen.getAllByRole("listitem");
    expect(detailItems).toHaveLength(1);
    expect(detailItems[0]).toHaveTextContent("朝の散歩が気持ちよかった");
  });

  it("削除成功時に今日の記録を削除して入力欄と詳細を空にする", async () => {
    const today = getTodayDate();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    configureSupabaseMock({
      selectResult: createSelectResult([
        {
          date: today,
          things1: "朝に洗濯できた",
          things2: "午後に集中できた",
          things3: "夜に早めに休めた",
        },
      ]),
    });
    await renderLoadedCard();

    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "削除前の下書き" },
    });
    expect(
      window.localStorage.getItem(getThreeGoodThingsDraftKey(USER_ID)),
    ).not.toBeNull();

    fireEvent.click(screen.getByTitle(today));
    expect(
      await screen.findByText(`📅 ${today} のよかったこと`),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: `${today} の記録を削除` }),
    );

    await waitFor(() => {
      expect(
        screen.queryByText(`📅 ${today} のよかったこと`),
      ).not.toBeInTheDocument();
    });
    expect(confirm).toHaveBeenCalledWith(
      `${today} の記録を削除してもよろしいですか？`,
    );
    expect(supabaseMocks.deleteRecord).toHaveBeenCalled();
    expect(supabaseMocks.deleteUserEq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(supabaseMocks.deleteDateEq).toHaveBeenCalledWith("date", today);

    const inputs = screen.getAllByRole("textbox");
    expect(inputs[0]).toHaveValue("");
    expect(inputs[1]).toHaveValue("");
    expect(inputs[2]).toHaveValue("");
    expect(
      window.localStorage.getItem(getThreeGoodThingsDraftKey(USER_ID)),
    ).toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("過去日の記録を削除しても今日の下書きを残す", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const pastDate = [
      yesterday.getFullYear(),
      String(yesterday.getMonth() + 1).padStart(2, "0"),
      String(yesterday.getDate()).padStart(2, "0"),
    ].join("-");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    configureSupabaseMock({
      selectResult: createSelectResult([
        { date: pastDate, things1: "過去の記録", things2: "", things3: "" },
      ]),
    });
    await renderLoadedCard();
    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "今日の下書き" },
    });

    fireEvent.click(screen.getByTitle(pastDate));
    fireEvent.click(
      await screen.findByRole("button", { name: `${pastDate} の記録を削除` }),
    );

    await waitFor(() => expect(supabaseMocks.deleteDateEq).toHaveBeenCalled());
    expect(confirm).toHaveBeenCalled();
    expect(
      window.localStorage.getItem(getThreeGoodThingsDraftKey(USER_ID)),
    ).not.toBeNull();
  });

  it("取得失敗時も認証済みユーザーの有効な下書きを復元する", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    window.localStorage.setItem(
      getThreeGoodThingsDraftKey(USER_ID),
      JSON.stringify({ date: getTodayDate(), things: ["取得失敗でも復元", "", ""] }),
    );
    configureSupabaseMock({
      selectResult: { data: null, error: { message: "select failed" } },
    });

    await renderLoadedCard();

    expect(screen.getAllByRole("textbox")[0]).toHaveValue("取得失敗でも復元");
    expect(screen.getByRole("status")).toHaveTextContent("復元しました");
    expect(screen.getByRole("alert")).toHaveTextContent(LOAD_ERROR_MESSAGE);
    expect(consoleError).toHaveBeenCalled();
  });

  it("記録取得中に想定外の例外が発生した場合は読込エラーを表示する", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    configureSupabaseMock({
      getUserException: new Error("getUser exploded"),
    });

    let renderError: unknown;
    try {
      render(<ThreeGoodThingsCard />);
    } catch (error) {
      renderError = error;
    }

    expect(renderError).toBeUndefined();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      LOAD_ERROR_MESSAGE,
    );
    expect(screen.queryByText(LOADING_MESSAGE)).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();
  });

  it("保存中に想定外の例外が発生した場合は保存エラーを表示して再操作可能に戻る", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    configureSupabaseMock({
      upsertException: new Error("upsert exploded"),
    });
    await renderLoadedCard();
    const inputs = screen.getAllByRole("textbox");

    fireEvent.change(inputs[0], { target: { value: "朝の空気が気持ちよかった" } });
    fireEvent.change(inputs[1], { target: { value: "温かいお茶を飲めた" } });
    fireEvent.change(inputs[2], { target: { value: "少しだけ片付けできた" } });

    let clickError: unknown;
    try {
      fireEvent.click(screen.getByRole("button", { name: "記録する" }));
    } catch (error) {
      clickError = error;
    }

    expect(clickError).toBeUndefined();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      SAVE_ERROR_MESSAGE,
    );
    expect(
      screen.queryByText("✨ 保存しました！今日もお疲れ様です ✨"),
    ).not.toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: "記録する" });
    expect(saveButton).toBeEnabled();
    expect(inputs[0]).toHaveValue("朝の空気が気持ちよかった");
    expect(inputs[1]).toHaveValue("温かいお茶を飲めた");
    expect(inputs[2]).toHaveValue("少しだけ片付けできた");
    expect(
      window.localStorage.getItem(getThreeGoodThingsDraftKey(USER_ID)),
    ).not.toBeNull();
    expect(consoleError).toHaveBeenCalled();
    expect(supabaseMocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        things1: "朝の空気が気持ちよかった",
        things2: "温かいお茶を飲めた",
        things3: "少しだけ片付けできた",
        user_id: USER_ID,
      }),
      { onConflict: "user_id,date" },
    );
  });

  it("localStorageの読み書きと削除の例外を画面操作へ伝播させない", async () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("getItem unavailable");
      });
    await renderLoadedCard();
    getItem.mockRestore();

    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("setItem unavailable");
      });
    const input = screen.getAllByRole("textbox")[0];
    expect(() =>
      fireEvent.change(input, { target: { value: "入力は続けられる" } }),
    ).not.toThrow();
    expect(input).toHaveValue("入力は続けられる");
    setItem.mockRestore();

    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new Error("removeItem unavailable");
      });
    expect(() => fireEvent.click(screen.getByRole("button", { name: "記録する" }))).not.toThrow();
    expect(await screen.findByText(/保存しました/)).toBeInTheDocument();
    expect(supabaseMocks.upsert).toHaveBeenCalled();
    removeItem.mockRestore();
  });

  it("アンマウント後に未完了の取得結果で更新しない", async () => {
    let finishGetUser: ((result: UserResult) => void) | undefined;
    supabaseMocks.getUser.mockImplementation(
      () => new Promise((resolve) => { finishGetUser = resolve; }),
    );
    const getItem = vi.spyOn(Storage.prototype, "getItem");
    const rendered = render(<ThreeGoodThingsCard />);

    rendered.unmount();
    finishGetUser?.(createUserResult());
    await Promise.resolve();

    expect(getItem).not.toHaveBeenCalled();
    expect(supabaseMocks.from).not.toHaveBeenCalled();
  });

  it("削除中に想定外の例外が発生した場合は記録を残して再操作可能に戻る", async () => {
    const today = getTodayDate();
    const firstThing = "昼に散歩できた";
    const secondThing = "友だちから連絡が来た";
    const thirdThing = "夕飯がおいしかった";
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    configureSupabaseMock({
      deleteException: new Error("delete exploded"),
      selectResult: createSelectResult([
        {
          date: today,
          things1: firstThing,
          things2: secondThing,
          things3: thirdThing,
        },
      ]),
    });
    await renderLoadedCard();

    fireEvent.click(screen.getByTitle(today));
    expect(
      await screen.findByText(`📅 ${today} のよかったこと`),
    ).toBeInTheDocument();

    const deleteButton = screen.getByRole("button", {
      name: `${today} の記録を削除`,
    });
    fireEvent.click(deleteButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      DELETE_ERROR_MESSAGE,
    );
    expect(screen.getAllByText(firstThing).length).toBeGreaterThan(0);
    expect(screen.getAllByText(secondThing).length).toBeGreaterThan(0);
    expect(screen.getAllByText(thirdThing).length).toBeGreaterThan(0);
    expect(screen.getByText(`📅 ${today} のよかったこと`)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `${today} の記録を削除` }),
    ).toBeEnabled();
    expect(consoleError).toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(
      `${today} の記録を削除してもよろしいですか？`,
    );
    expect(supabaseMocks.deleteRecord).toHaveBeenCalled();
    expect(supabaseMocks.deleteUserEq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(supabaseMocks.deleteDateEq).toHaveBeenCalledWith("date", today);
  });
});
