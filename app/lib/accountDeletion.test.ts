import { beforeEach, describe, expect, it, vi } from "vitest";
import { advanceDeletion, prepareDeletion, type DeletionActor, type DeletionDependencies, type DeletionOperation } from "./accountDeletion";
const actor: DeletionActor = { id: "A", email: "a@example.test", sessionId: "session-A" };
const now = Date.parse("2026-10-04T00:00:00Z");
let op: DeletionOperation | null;
let deps: DeletionDependencies;
const prepare = () => prepareDeletion(deps, actor, { id: "operation-A", receiptHash: "hash-A" });
const act = (action: "verify" | "delete" | "status" | "cancel", extra = {}) =>
  advanceDeletion(deps, "hash-A", actor, { action, ...extra });
async function ready() { await prepare(); await act("verify", { token: "123456" }); }
beforeEach(() => {
  op = null;
  deps = {
    now: () => now,
    insert: vi.fn(async value => { if (op) return false; op = structuredClone(value); return true; }),
    get: vi.fn(async hash => hash === op?.receipt_hash ? structuredClone(op) : null),
    transition: vi.fn(async (old, status, patch = {}) => {
      if (!op || op.id !== old.id || op.status !== old.status || op.attempts !== old.attempts) return false;
      op = { ...op, ...patch, status }; return true;
    }),
    cancel: vi.fn(async old => { if (op?.status !== old.status) return false; op = null; return true; }),
    sendCode: vi.fn(async () => true), verifyCode: vi.fn(async () => "A"),
    deleteUser: vi.fn(async () => {}), isCompletelyDeleted: vi.fn(async () => true),
  };
});
describe("deletion authorization and state", () => {
  it("reserves one operation before sending OTP; repeats do not send again", async () => {
    expect((await prepare()).status).toBe("pending");
    expect((await prepare()).status).toBe("busy");
    expect(deps.sendCode).toHaveBeenCalledExactlyOnceWith(actor.email);
    expect(deps.deleteUser).not.toHaveBeenCalled();
  });
  it("does not retain a proof when OTP sending fails", async () => {
    vi.mocked(deps.sendCode).mockResolvedValue(false);
    expect((await prepare()).status).toBe("error"); expect(op).toBeNull();
  });
  it("requires fresh proof and explicit final confirmation", async () => {
    await prepare();
    expect((await act("delete", { confirmed: true })).status).toBe("invalid");
    await act("verify", { token: "123456" });
    expect((await act("delete")).status).toBe("invalid");
    expect(deps.deleteUser).not.toHaveBeenCalled();
    expect(await act("delete", { confirmed: true })).toMatchObject({ status: "succeeded", cleanupUserId: "A" });
    expect(deps.deleteUser).toHaveBeenCalledExactlyOnceWith("A");
  });
  it.each([null, { ...actor, id: "B" }, { ...actor, sessionId: "other-session" }])("rejects missing/other identity or session %j", async other => {
    await ready();
    await advanceDeletion(deps, "hash-A", other, { action: "delete", confirmed: true });
    expect(deps.deleteUser).not.toHaveBeenCalled();
  });
  it("rejects another OTP account and limits attempts to five", async () => {
    await prepare(); vi.mocked(deps.verifyCode).mockResolvedValue("B");
    for (let i=0; i<6; i++) expect((await act("verify", { token: "123456" })).status).toBe("invalid");
    expect(deps.verifyCode).toHaveBeenCalledTimes(5); expect(op?.status).toBe("pending");
  });
  it("does not accept malformed codes", async () => {
    await prepare(); await act("verify", { token: "<secret>" });
    expect(deps.verifyCode).not.toHaveBeenCalled();
  });
  it("expired proof cannot authorize deletion", async () => {
    await ready(); deps.now = () => now + 6 * 60_000;
    expect((await act("delete", { confirmed: true })).status).toBe("expired");
    expect(deps.deleteUser).not.toHaveBeenCalled();
  });
  it("rechecks expiry after slow OTP verification", async () => {
    await prepare();
    vi.mocked(deps.verifyCode).mockImplementation(async () => { deps.now = () => now + 11 * 60_000; return "A"; });
    expect((await act("verify", { token: "123456" })).status).toBe("invalid");
  });
  it("two concurrent deletion requests call Admin once", async () => {
    await ready();
    await Promise.all([act("delete", { confirmed: true }), act("delete", { confirmed: true })]);
    expect(deps.deleteUser).toHaveBeenCalledTimes(1);
  });
  it("lost response preserves unknown; receipt can reconcile without Auth", async () => {
    await ready(); vi.mocked(deps.deleteUser).mockRejectedValue(new Error("lost response"));
    expect((await act("delete", { confirmed: true })).status).toBe("unknown");
    expect(await advanceDeletion(deps, "hash-A", null, { action: "status" })).toMatchObject({ status: "succeeded", cleanupUserId: "A" });
    expect(deps.deleteUser).toHaveBeenCalledTimes(1);
  });
  it("remaining Auth/data never becomes success and cannot be cancelled or retried", async () => {
    await ready(); vi.mocked(deps.isCompletelyDeleted).mockResolvedValue(false);
    expect((await act("delete", { confirmed: true })).status).toBe("unknown");
    expect((await act("status")).status).toBe("unknown");
    expect((await act("cancel")).status).toBe("busy");
    await act("delete", { confirmed: true }); expect(deps.deleteUser).toHaveBeenCalledTimes(1);
  });
  it("state-persistence outage remains reconcilable", async () => {
    await ready(); const transition = deps.transition;
    deps.transition = vi.fn(async (...args: Parameters<DeletionDependencies["transition"]>) => { if (args[1] !== "processing") throw new Error("outage"); return transition(...args); });
    expect((await act("delete", { confirmed: true })).status).toBe("unknown");
    expect(op?.status).toBe("processing");
    deps.transition = transition;
    expect((await act("status")).status).toBe("succeeded");
  });
  it("cancel before submission never deletes Auth", async () => {
    await ready(); expect((await act("cancel")).status).toBe("cancelled");
    expect(op).toBeNull(); expect(deps.deleteUser).not.toHaveBeenCalled();
  });
  it("invalid/expired receipts do not expose or delete anything", async () => {
    await ready();
    expect((await advanceDeletion(deps, "other", null, { action: "status" })).status).toBe("expired");
    deps.now = () => now + 61 * 60_000;
    expect((await act("status")).status).toBe("expired");
    expect(deps.deleteUser).not.toHaveBeenCalled();
  });
});
