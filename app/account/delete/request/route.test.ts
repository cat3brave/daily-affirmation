import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ config: vi.fn(), actor: vi.fn(), deps: vi.fn(), prepare: vi.fn(), advance: vi.fn(), jar: { get: vi.fn(), set: vi.fn() } }));
vi.mock("next/headers", () => ({ cookies: async () => mocks.jar }));
vi.mock("../../../lib/accountDeletionServer", () => ({
  DELETION_COOKIE: "receipt", deletionConfiguration: mocks.config, deletionActor: mocks.actor,
  deletionDependencies: mocks.deps, receiptHash: () => "hash",
}));
vi.mock("../../../lib/accountDeletion", () => ({ prepareDeletion: mocks.prepare, advanceDeletion: mocks.advance }));
import { POST } from "./route";
const request = (body: unknown, origin = "https://app.test", contentType = "application/json") => new Request("https://app.test/account/delete/request", {
  method: "POST", headers: { origin, "content-type": contentType }, body: JSON.stringify(body),
});
beforeEach(() => {
  mocks.config.mockReturnValue({ origin: "https://app.test" });
  mocks.actor.mockResolvedValue({ id: "A", email: "a@example.test", sessionId: "session-A" });
  mocks.prepare.mockResolvedValue({ status: "pending", operationId: "op" });
  mocks.advance.mockResolvedValue({ status: "unknown" });
  mocks.jar.get.mockReturnValue({ value: "a".repeat(64) });
});
it("fails closed without the release configuration", async () => {
  mocks.config.mockReturnValue(null);
  expect((await POST(request({ action: "delete", confirmed: true }))).status).toBe(503);
  expect(mocks.deps).not.toHaveBeenCalled();
});
it.each(["https://evil.test", "null", ""])("rejects origin %s before admin setup", async origin => {
  expect((await POST(request({ action: "prepare" }, origin))).status).toBe(403);
  expect(mocks.deps).not.toHaveBeenCalled();
});
it.each([{ action: "delete", userId: "B", confirmed: true }, { action: "delete", confirmed: "true" }, { action: "verify", token: {} }, { action: "unexpected" }])("rejects client-controlled target/malformed payload %j", async input => {
  expect((await POST(request(input))).status).toBe(400); expect(mocks.advance).not.toHaveBeenCalled();
});
it("requires authenticated user before preparation", async () => {
  mocks.actor.mockResolvedValue(null);
  expect((await POST(request({ action: "prepare" }))).status).toBe(401);
  expect(mocks.prepare).not.toHaveBeenCalled();
});
it("creates an HttpOnly same-site receipt only after preparation", async () => {
  expect((await POST(request({ action: "prepare" }))).status).toBe(200);
  expect(mocks.jar.set).toHaveBeenCalledWith("receipt", expect.stringMatching(/^[a-f0-9]{64}$/), expect.objectContaining({ httpOnly: true, sameSite: "strict", path: "/account/delete", maxAge: 3600 }));
});
it("receipt-only status works after Auth deletion but cannot specify an owner", async () => {
  await POST(request({ action: "status" }));
  expect(mocks.actor).not.toHaveBeenCalled();
  expect(mocks.advance).toHaveBeenCalledWith(undefined, "hash", null, { action: "status" });
});
it("does not leak exception messages or delete cookies after transport errors", async () => {
  mocks.advance.mockRejectedValue(new Error("secret-token"));
  const response = await POST(request({ action: "delete", confirmed: true }));
  expect(await response.json()).toEqual({ status: "unknown" }); expect(mocks.jar.set).not.toHaveBeenCalled();
});
it("rejects missing receipts", async () => {
  mocks.jar.get.mockReturnValue(undefined);
  expect(await (await POST(request({ action: "delete", confirmed: true }))).json()).toEqual({ status: "expired" });
  expect(mocks.advance).not.toHaveBeenCalled();
});
it("rejects non-JSON and oversized input", async () => {
  expect((await POST(request({ action: "prepare" }, "https://app.test", "text/plain"))).status).toBe(400);
  expect((await POST(request({ action: "verify", token: "1".repeat(2100) }))).status).toBe(400);
});
