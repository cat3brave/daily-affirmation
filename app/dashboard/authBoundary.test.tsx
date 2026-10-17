import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthUser } from "../hooks/useAuthUser";
import { DashboardAuthContext } from "../hooks/dashboardAuth";
import { useFavoriteAffirmations } from "../hooks/useFavoriteAffirmations";
import { useFlowerGarden } from "../hooks/useFlowerGarden";
import { useAffirmationGenerator } from "../hooks/useAffirmationGenerator";
import DataExportButton from "../components/DataExportButton";
import GentleTranslatorCard from "../components/GentleTranslatorCard";
import ThreeGoodThingsCard from "../components/ThreeGoodThingsCard";
import LogoutButton from "../components/LogoutButton";
import BloomGraph from "../components/BloomGraph";

const mocks = vi.hoisted(() => {
  const router = { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() };
  const getUser = vi.fn();
  const unsubscribe = vi.fn();
  let listener: (event: string, session: { user: { id: string } } | null) => void;
  const onAuthStateChange = vi.fn((callback: typeof listener) => {
    listener = callback;
    return { data: { subscription: { unsubscribe } } };
  });
  const load = vi.fn();
  const insert = vi.fn();
  const remove = vi.fn();
  const count = vi.fn();
  const graph = vi.fn();
  const records = vi.fn();
  const signOut = vi.fn();
  const from = vi.fn((table: string) => ({
    select: (_: string, options?: unknown) => ({ eq: () => table === "favorite_affirmations" ? { order: load } : table === "three_good_things" ? records() : options ? count() : { gte: graph } }),
    insert, upsert: insert,
    delete: () => ({ eq: () => ({ eq: remove }) }),
  }));
  return { router, getUser, unsubscribe, onAuthStateChange, load, insert, remove, count, graph, records, signOut, from,
    emit: (id: string | null, event = "SIGNED_IN") => listener(event, id ? { user: { id } } : null),
    client: { auth: { getUser, onAuthStateChange, signOut }, from }, generate: vi.fn(), translate: vi.fn(), exportData: vi.fn() };
});
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("../lib/supabaseClient", () => ({ createSupabaseBrowserClient: () => mocks.client }));
vi.mock("../actions", () => ({ generateAffirmation: mocks.generate, translateHarshVoice: mocks.translate }));
vi.mock("../exportDataAction", () => ({ exportUserData: mocks.exportData }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function Owned({ auth }: { auth: ReturnType<typeof useAuthUser> }) {
  const favorites = useFavoriteAffirmations(auth.userId, auth.supabase);
  const garden = useFlowerGarden(auth.userId, auth.supabase);
  const ai = useAffirmationGenerator();
  return <>
    <output data-testid="owner">{auth.userId}</output>
    <output data-testid="favorites">{favorites.favoriteAffirmations.join(",")}</output>
    <output data-testid="favorite-error">{favorites.favoriteError}{favorites.favoriteLoadError}</output>
    <output data-testid="garden">{JSON.stringify([garden.growth, garden.totalBlooms, garden.currentFlower, garden.isBloomSaving, garden.flowerError, garden.flowerLoadError])}</output>
    <output data-testid="ai">{ai.text}{ai.authError}{ai.rateLimitError}{ai.timeoutError}{ai.usageError}{String(ai.isLoading)}</output>
    <button onClick={() => favorites.handleFavoriteAffirmation("same")}>save</button>
    <button onClick={() => favorites.handleRemoveFavoriteAffirmation("same")}>delete</button>
    <button onClick={garden.handleWalk}>walk</button>
    <button onClick={ai.handleGenerateAffirmation}>generate</button>
    <DataExportButton /><LogoutButton userId={auth.userId!} /><GentleTranslatorCard /><ThreeGoodThingsCard /><BloomGraph userId={auth.userId!} refreshKey={0} />
  </>;
}
function Boundary() {
  const auth = useAuthUser({ id: "A", email: "a@example.com" });
  return auth.userId ? <DashboardAuthContext.Provider value={auth}><Owned key={`${auth.authGeneration}:${auth.userId}`} auth={auth} /></DashboardAuthContext.Provider> : <p>checking</p>;
}
async function flush() { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); }
async function change(id: string | null) {
  mocks.getUser.mockResolvedValue({ data: { user: id ? { id } : null }, error: null });
  act(() => mocks.emit(id));
  expect(screen.queryByTestId("owner")).not.toBeInTheDocument();
  await flush();
}
async function click(name: string) { await act(async () => { fireEvent.click(screen.getByRole("button", { name })); }); }
const exportData = { schemaVersion: 1, exportedAt: "2026-10-11T00:00:00Z", todos: [], favoriteAffirmations: [], threeGoodThings: [], bloomLogs: [] };
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.clearAllMocks();
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  localStorage.clear();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "A" } }, error: null });
  mocks.load.mockResolvedValue({ data: [], error: null });
  mocks.count.mockResolvedValue({ count: 0, error: null });
  mocks.records.mockResolvedValue({ data: [], error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.graph.mockResolvedValue({ data: [], error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.generate.mockResolvedValue({ status: "success", text: "current AI" });
  mocks.translate.mockResolvedValue({ status: "success", text: "current translation" });
  mocks.exportData.mockResolvedValue({ status: "success", data: exportData });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("dashboard authentication boundary (mock only)", () => {
  it.each(["B", null, "ABA"])("discards old fetch/save after A → %s", async (destination) => {
    const oldLoad = deferred<{ data: { text: string }[]; error: null }>();
    const oldSave = deferred<{ error: null }>();
    mocks.load.mockReturnValueOnce(oldLoad.promise);
    mocks.insert.mockReturnValueOnce(oldSave.promise);
    render(<Boundary />); await flush();
    await click("save");
    await change(destination === "ABA" ? "B" : destination);
    if (destination === "ABA") await change("A");
    if (destination !== null) {
      await click("save");
      await click("delete");
    }
    await act(async () => { oldLoad.resolve({ data: [{ text: "old A" }], error: null }); oldSave.resolve({ error: null }); });
    if (destination !== null) {
      expect(screen.getByTestId("favorites")).not.toHaveTextContent("old A");
      expect(localStorage.getItem(`favoriteAffirmations:${destination === "ABA" ? "A" : destination}`)).not.toContain("old A");
    } else expect(screen.queryByTestId("favorites")).not.toBeInTheDocument();
  });

  it.each(["success", "reject"])("old same-text save %s does not unlock or roll back B's pending save", async (outcome) => {
    const old = deferred<{ error: null }>(); const next = deferred<{ error: null }>();
    mocks.insert.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    render(<Boundary />); await flush(); await click("save");
    await change("B"); await click("save");
    await act(async () => { if (outcome === "reject") old.reject(new Error("old failure")); else old.resolve({ error: null }); });
    expect(screen.getByTestId("favorites")).toHaveTextContent("same");
    expect(screen.getByTestId("favorite-error")).toBeEmptyDOMElement();
    await click("save"); expect(mocks.insert).toHaveBeenCalledTimes(2);
    await act(async () => { next.resolve({ error: null }); });
    expect(localStorage.getItem("favoriteAffirmations:B")).toBe('["same"]');
  });

  it.each(["B", null, "ABA"])("old deletion rollback cannot restore A's item after %s", async (destination) => {
    mocks.load.mockResolvedValueOnce({ data: [{ text: "same" }], error: null });
    const old = deferred<{ error: { message: string } }>(); mocks.remove.mockReturnValueOnce(old.promise);
    render(<Boundary />); await flush(); await click("delete");
    await change(destination === "ABA" ? "B" : destination);
    if (destination === "ABA") await change("A");
    await act(async () => old.resolve({ error: { message: "old failure" } }));
    if (destination !== null) { expect(screen.getByTestId("favorites")).toBeEmptyDOMElement(); expect(screen.getByTestId("favorite-error")).toBeEmptyDOMElement(); }
    else expect(screen.queryByTestId("favorites")).not.toBeInTheDocument();
  });

  it("resets garden growth, flower, total and save lock; old finally cannot release B's lock", async () => {
    const old = deferred<{ error: null }>(); const next = deferred<{ error: null }>();
    mocks.insert.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    render(<Boundary />); await flush();
    for (let i = 0; i < 4; i++) await click("walk");
    expect(screen.getByTestId("garden")).toHaveTextContent('[3,0,"🌸",true');
    await change("B"); expect(screen.getByTestId("garden")).toHaveTextContent('[0,0,"🌸",false');
    for (let i = 0; i < 4; i++) await click("walk");
    await act(async () => old.resolve({ error: null }));
    expect(screen.getByTestId("garden")).toHaveTextContent('[3,0,"🌸",true');
    await click("walk"); expect(mocks.insert).toHaveBeenCalledTimes(2);
    await act(async () => next.resolve({ error: null }));
    expect(screen.getByTestId("garden")).toHaveTextContent('[4,1,"🌸",false');
  });

  it("ignores old AI/translation/export and count/graph results after A→B→A", async () => {
    const ai = deferred<unknown>(); const translate = deferred<unknown>(); const exported = deferred<unknown>();
    const count = deferred<unknown>(); const graph = deferred<unknown>();
    mocks.generate.mockReturnValueOnce(ai.promise); mocks.translate.mockReturnValueOnce(translate.promise); mocks.exportData.mockReturnValueOnce(exported.promise);
    mocks.count.mockReturnValueOnce(count.promise); mocks.graph.mockReturnValueOnce(graph.promise);
    render(<Boundary />); await flush(); await click("generate");
    fireEvent.change(screen.getByLabelText("優しい言葉に翻訳したい自分への厳しい声"), { target: { value: "old input" } }); await click("優しい言葉に翻訳する 🪄"); await click("データを書き出す");
    await change("B"); await change("A");
    await act(async () => { ai.resolve({ status: "success", text: "old AI" }); translate.reject(new Error("old AI failure")); exported.resolve({ status: "success", data: exportData }); count.resolve({ count: 99, error: null }); graph.resolve({ data: [{ created_at: new Date().toISOString() }], error: null }); });
    expect(screen.getByTestId("ai")).toHaveTextContent("false"); expect(screen.queryByText("old AI")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument(); expect(screen.getByTestId("garden")).toHaveTextContent('[0,0,"🌸",false');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    await click("generate"); expect(screen.getByTestId("ai")).toHaveTextContent("current AI");
  });

  it("same-user TOKEN_REFRESHED and duplicate SIGNED_IN preserve input and growth", async () => {
    render(<Boundary />); await flush();
    fireEvent.change(screen.getByLabelText("優しい言葉に翻訳したい自分への厳しい声"), { target: { value: "keep input" } }); await click("walk");
    act(() => { mocks.emit("A", "TOKEN_REFRESHED"); mocks.emit("A"); }); await flush();
    expect(screen.getByLabelText("優しい言葉に翻訳したい自分への厳しい声")).toHaveValue("keep input"); expect(screen.getByTestId("garden")).toHaveTextContent('[1,0');
    expect(mocks.onAuthStateChange).toHaveBeenCalledOnce();
  });

  it("auth changes during ownership verification prevent mutation submission", async () => {
    const verifying = deferred<unknown>(); render(<Boundary />); await flush();
    mocks.getUser.mockReturnValueOnce(verifying.promise); await click("save");
    await change("B"); await act(async () => verifying.resolve({ data: { user: { id: "A" } }, error: null }));
    expect(mocks.insert).not.toHaveBeenCalled(); expect(screen.getByTestId("favorites")).toBeEmptyDOMElement();
  });

  it("owner mismatch hides data before any write is sent", async () => {
    render(<Boundary />); await flush();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "B" } }, error: null }); await click("save");
    expect(screen.queryByTestId("owner")).not.toBeInTheDocument(); expect(mocks.insert).not.toHaveBeenCalled();
    await flush(); expect(screen.getByTestId("owner")).toHaveTextContent("B");
  });

  it("unmount prevents downloads and unsubscribes/listeners are removed", async () => {
    const exported = deferred<unknown>(); mocks.exportData.mockReturnValueOnce(exported.promise);
    const removedWindow = vi.spyOn(window, "removeEventListener"); const removedDocument = vi.spyOn(document, "removeEventListener");
    const view = render(<Boundary />); await flush(); await click("データを書き出す"); view.unmount();
    await act(async () => exported.resolve({ status: "success", data: exportData }));
    expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(mocks.unsubscribe).toHaveBeenCalledOnce();
    expect(removedWindow).toHaveBeenCalledWith("focus", expect.any(Function)); expect(removedWindow).toHaveBeenCalledWith("storage", expect.any(Function));
    expect(removedDocument).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    const calls = mocks.getUser.mock.calls.length; window.dispatchEvent(new Event("focus")); expect(mocks.getUser).toHaveBeenCalledTimes(calls);
  });
  it("shares one subscription with ThreeGoodThings and preserves drafts on token refresh and account change", async () => {
    render(<Boundary />); await flush();
    fireEvent.change(screen.getByLabelText("1つ目のよかったこと"), { target: { value: "A draft" } });
    act(() => mocks.emit("A", "TOKEN_REFRESHED")); await flush();
    expect(screen.getByLabelText("1つ目のよかったこと")).toHaveValue("A draft");
    await change("B"); expect(screen.getByLabelText("1つ目のよかったこと")).toHaveValue("");
    expect(localStorage.getItem("daily-affirmation:three-good-things-draft:A")).toContain("A draft");
    await change("A"); expect(screen.getByLabelText("1つ目のよかったこと")).toHaveValue("A draft");
    expect(mocks.onAuthStateChange).toHaveBeenCalledOnce();
  });

  it("old logout verification cannot sign out B or clear either owner's cache", async () => {
    render(<Boundary />); await flush();
    localStorage.setItem("favoriteAffirmations:A", '["A cache"]');
    const checking = deferred<unknown>(); mocks.getUser.mockReturnValueOnce(checking.promise);
    await click("👋 ログアウト"); await change("B");
    await act(async () => checking.resolve({ data: { user: { id: "A" } }, error: null }));
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(localStorage.getItem("favoriteAffirmations:A")).toBe('["A cache"]');
    await click("👋 ログアウト"); expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(localStorage.getItem("favoriteAffirmations:A")).toBe('["A cache"]');
    expect(localStorage.getItem("favoriteAffirmations:B")).toBeNull();
  });

  it("an unknown authentication result hides personal data and does not send writes", async () => {
    render(<Boundary />); await flush();
    mocks.getUser.mockRejectedValueOnce(new Error("authentication unavailable"));
    await click("save");
    expect(screen.queryByTestId("favorites")).not.toBeInTheDocument();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("StrictMode replay starts garden/graph loads and preserves their retry UI", async () => {
    mocks.count.mockResolvedValue({ count: null, error: { message: "temporary count failure" } });
    mocks.graph.mockResolvedValue({ data: null, error: { message: "temporary graph failure" } });
    render(<StrictMode><Boundary /></StrictMode>); await flush();
    expect(screen.getByTestId("garden")).toHaveTextContent("お花の記録を読み込めませんでした");
    expect(screen.getByRole("button", { name: "成長記録を再読み込み" })).toBeEnabled();
    mocks.graph.mockResolvedValue({ data: [], error: null });
    await click("成長記録を再読み込み");
    expect(screen.getByRole("region", { name: "お花の成長記録（過去3ヶ月）" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "成長記録を再読み込み" })).not.toBeInTheDocument();
  });

  it.each(["timed_out", "success", "reject"])("old AI %s cannot update or unlock new requests after authentication changes", async (outcome) => {
    const oldAI = deferred<unknown>(); const oldTranslation = deferred<unknown>();
    const newAI = deferred<unknown>(); const newTranslation = deferred<unknown>();
    mocks.generate.mockReturnValueOnce(oldAI.promise).mockReturnValueOnce(newAI.promise);
    mocks.translate.mockReturnValueOnce(oldTranslation.promise).mockReturnValueOnce(newTranslation.promise);
    render(<Boundary />); await flush(); await click("generate");
    const input = "優しい言葉に翻訳したい自分への厳しい声";
    fireEvent.change(screen.getByLabelText(input), { target: { value: "old input" } });
    await click("優しい言葉に翻訳する 🪄");
    await change("B"); await change("A"); await click("generate");
    fireEvent.change(screen.getByLabelText(input), { target: { value: "new input" } });
    await click("優しい言葉に翻訳する 🪄");
    await act(async () => {
      if (outcome === "reject") {
        oldAI.reject(new Error("old failure")); oldTranslation.reject(new Error("old failure"));
      } else {
        const value = { status: outcome, text: "old result", message: "old timeout" };
        oldAI.resolve(value); oldTranslation.resolve(value);
      }
    });
    expect(screen.getByTestId("ai")).toHaveTextContent("true");
    expect(screen.getByTestId("ai")).not.toHaveTextContent(/old/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("old result")).not.toBeInTheDocument();
    expect(screen.getByLabelText(input)).toHaveValue("new input");
    expect(screen.getByLabelText(input)).toBeDisabled();
    await click("generate"); expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(mocks.translate).toHaveBeenCalledTimes(2);
    await act(async () => {
      newAI.resolve({ status: "success", text: "new AI" });
      newTranslation.resolve({ status: "success", text: "new translation" });
    });
    expect(screen.getByTestId("ai")).toHaveTextContent("new AIfalse");
    expect(screen.getByLabelText(input)).toBeEnabled();
    expect(screen.getByText("new translation")).toBeInTheDocument();
  });

  it.each(["timed_out", "success", "reject"])("discards AI %s after logout or unmount", async (outcome) => {
    for (const logout of [true, false]) {
      const ai = deferred<unknown>(); const translation = deferred<unknown>();
      mocks.generate.mockReturnValueOnce(ai.promise); mocks.translate.mockReturnValueOnce(translation.promise);
      mocks.getUser.mockResolvedValue({ data: { user: { id: "A" } }, error: null });
      const view = render(<Boundary />); await flush(); await click("generate");
      fireEvent.change(screen.getByLabelText("優しい言葉に翻訳したい自分への厳しい声"), { target: { value: "old input" } });
      await click("優しい言葉に翻訳する 🪄");
      if (logout) await change(null); else view.unmount();
      await act(async () => {
        if (outcome === "reject") {
          ai.reject(new Error("old failure")); translation.reject(new Error("old failure"));
        } else {
          const value = { status: outcome, text: "old result", message: "old timeout" };
          ai.resolve(value); translation.resolve(value);
        }
      });
      expect(screen.queryByTestId("ai")).not.toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.queryByText("old result")).not.toBeInTheDocument();
      view.unmount();
    }
  });

});

it.each(["B", null, "unmount"])("discards late usage denials after %s", async (destination) => {
  const ai = deferred<unknown>(); const translation = deferred<unknown>();
  mocks.generate.mockReturnValueOnce(ai.promise); mocks.translate.mockReturnValueOnce(translation.promise);
  const view = render(<Boundary />); await flush(); await click("generate");
  fireEvent.change(screen.getByLabelText("優しい言葉に翻訳したい自分への厳しい声"), { target: { value: "old input" } });
  await click("優しい言葉に翻訳する 🪄");
  if (destination === "unmount") view.unmount(); else await change(destination);
  await act(async () => {
    ai.resolve({ status: "usage_limited", reason: "daily_limit", retryAt: "2026-10-18T15:00:00Z", message: "old usage denial" });
    translation.resolve({ status: "usage_unavailable", message: "old usage failure" });
  });
  expect(screen.queryByText(/old usage/)).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
