import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  configureSupabaseMock();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ThreeGoodThingsCard", () => {
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
    fireEvent.click(screen.getByRole("button", { name: "記録する" }));

    expect(
      await screen.findByText("✨ 保存しました！今日もお疲れ様です ✨"),
    ).toBeInTheDocument();
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

    expect(screen.getByText(`📅 ${today} のよかったこと`)).toBeInTheDocument();
    const detailItems = screen.getAllByRole("listitem");
    expect(detailItems).toHaveLength(3);
    expect(detailItems[0]).toHaveTextContent(firstThing);
    expect(detailItems[1]).toHaveTextContent(secondThing);
    expect(detailItems[2]).toHaveTextContent(thirdThing);
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

    fireEvent.click(screen.getByTitle(today));
    expect(
      await screen.findByText(`📅 ${today} のよかったこと`),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("この日の記録を削除"));

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
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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

    const deleteButton = screen.getByTitle("この日の記録を削除");
    fireEvent.click(deleteButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      DELETE_ERROR_MESSAGE,
    );
    expect(screen.getAllByText(firstThing).length).toBeGreaterThan(0);
    expect(screen.getAllByText(secondThing).length).toBeGreaterThan(0);
    expect(screen.getAllByText(thirdThing).length).toBeGreaterThan(0);
    expect(screen.getByText(`📅 ${today} のよかったこと`)).toBeInTheDocument();
    expect(screen.getByTitle("この日の記録を削除")).toBeEnabled();
    expect(consoleError).toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledWith(
      `${today} の記録を削除してもよろしいですか？`,
    );
    expect(supabaseMocks.deleteRecord).toHaveBeenCalled();
    expect(supabaseMocks.deleteUserEq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(supabaseMocks.deleteDateEq).toHaveBeenCalledWith("date", today);
  });
});
