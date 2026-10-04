import { afterEach, expect, it } from "vitest";
import { isAccountDeleted, markAccountDeleted } from "./deletedAccount";
import { writeThreeGoodThingsDraft } from "./threeGoodThingsDraft";
afterEach(() => localStorage.clear());
it("deleted-account marker prevents an old tab from recreating its draft", () => {
  expect(markAccountDeleted("A")).toBe(true);
  expect(isAccountDeleted("A")).toBe(true); expect(isAccountDeleted("B")).toBe(false);
  writeThreeGoodThingsDraft("A","2026-10-04",["old","",""]);
  expect(localStorage.getItem("daily-affirmation:three-good-things-draft:A")).toBeNull();
  writeThreeGoodThingsDraft("B","2026-10-04",["keep","",""]);
  expect(localStorage.getItem("daily-affirmation:three-good-things-draft:B")).not.toBeNull();
});
