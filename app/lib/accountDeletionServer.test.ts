import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), serverClient: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("./supabaseServer", () => ({ createSupabaseServerClient: mocks.serverClient }));
import { deletionActor, deletionConfiguration, deletionDependencies, receiptHash } from "./accountDeletionServer";
import type { DeletionOperation } from "./accountDeletion";
const config = { url: "https://example.supabase.co", publicKey: "fake-public", secret: "fake-server-secret", origin: "https://app.test" };
const op: DeletionOperation = { id: "op", user_id: "A", session_id: "s", receipt_hash: "hash", status: "ready", attempts: 1, expires_at: "2026-01-01", receipt_expires_at: "2026-01-02" };
const env = { ACCOUNT_DELETION_ENABLED: "true", ACCOUNT_DELETION_DB_VERIFIED: "true", ACCOUNT_DELETION_EMAIL_OTP_VERIFIED: "true", NEXT_PUBLIC_SUPABASE_URL: config.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: config.publicKey, SUPABASE_SERVICE_ROLE_KEY: config.secret, ACCOUNT_DELETION_ORIGIN: config.origin };
beforeEach(() => { for (const [key, value] of Object.entries(env)) vi.stubEnv(key,value); });
afterEach(() => vi.unstubAllEnvs());
it.each(Object.keys(env))("missing %s disables the feature", key => {
  vi.stubEnv(key, ""); expect(deletionConfiguration()).toBeNull(); expect(mocks.createClient).not.toHaveBeenCalled();
});
it("validates the origin and production TLS", () => {
  expect(deletionConfiguration()).toEqual(config);
  vi.stubEnv("ACCOUNT_DELETION_ORIGIN", "https://app.test/path"); expect(deletionConfiguration()).toBeNull();
  vi.stubEnv("ACCOUNT_DELETION_ORIGIN", "invalid"); expect(deletionConfiguration()).toBeNull();
  vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("ACCOUNT_DELETION_ORIGIN", "http://app.test"); expect(deletionConfiguration()).toBeNull();
});
it("hashes receipt bytes instead of storing the bearer receipt", () => {
  expect(receiptHash("receipt")).toMatch(/^[a-f0-9]{64}$/); expect(receiptHash("receipt")).not.toBe("receipt");
});
it("uses verified Auth user and matching signed session claim", async () => {
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "A", email: "a@test", email_confirmed_at: "date" } }, error: null });
  const getClaims = vi.fn().mockResolvedValue({ data: { claims: { sub: "A", session_id: "s" } }, error: null });
  mocks.serverClient.mockResolvedValue({ auth: { getUser, getClaims } });
  expect(await deletionActor()).toEqual({ id: "A", email: "a@test", sessionId: "s" });
  getClaims.mockResolvedValue({ data: { claims: { sub: "B", session_id: "s" } }, error: null });
  expect(await deletionActor()).toBeNull();
  getUser.mockResolvedValue({ data: { user: { id: "A", email: "a@test" } }, error: null });
  expect(await deletionActor()).toBeNull();
});
function clients() {
  const query = {
    select: vi.fn(), eq: vi.fn(), in: vi.fn(), lt: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), maybeSingle: vi.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null, count: 0 }).then(resolve),
  };
  for (const method of [query.select,query.eq,query.in,query.lt,query.update,query.delete]) method.mockReturnValue(query);
  query.insert.mockResolvedValue({ error: null }); query.maybeSingle.mockResolvedValue({ data: { id: "op" }, error: null });
  const admin = { from: vi.fn((table: string) => { void table; return query; }), auth: { admin: { deleteUser: vi.fn().mockResolvedValue({ error: null }), getUserById: vi.fn().mockResolvedValue({ data: { user: null }, error: { code: "user_not_found" } }) } } };
  const auth = { auth: { signInWithOtp: vi.fn().mockResolvedValue({ error: null }), verifyOtp: vi.fn().mockResolvedValue({ data: { user: { id: "A" }, session: {} }, error: null }), signOut: vi.fn().mockResolvedValue({ error: null }) } };
  mocks.createClient.mockImplementation((_url, key) => key === config.secret ? admin : auth);
  return { query, admin, auth, deps: deletionDependencies(config) };
}
it("admin and reauthentication clients never persist or share cookie sessions", async () => {
  const { deps,auth } = clients();
  expect(await deps.sendCode("a@test")).toBe(true);
  expect(auth.auth.signInWithOtp).toHaveBeenCalledWith({ email: "a@test", options: { shouldCreateUser: false } });
  expect(await deps.verifyCode("a@test","123456")).toBe("A");
  expect(auth.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  for (const call of mocks.createClient.mock.calls) expect(call[2].auth).toEqual({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
});
it("uses hard delete and checks all five owner columns", async () => {
  const { deps,admin,query } = clients(); await deps.deleteUser("A");
  expect(admin.auth.admin.deleteUser).toHaveBeenCalledWith("A",false);
  expect(await deps.isCompletelyDeleted("A")).toBe(true);
  expect(admin.from.mock.calls.map(call => call[0])).toEqual(["todos","profiles","bloom_logs","favorite_affirmations","three_good_things"]);
  expect(query.eq).toHaveBeenCalledWith("id","A"); expect(query.eq).toHaveBeenCalledWith("user_id","A");
});
it.each([{ code: "unexpected_failure" }, null])("does not infer absence from errors or existing user %j", async error => {
  const { deps,admin } = clients(); admin.auth.admin.getUserById.mockResolvedValue({ data: { user: null }, error });
  expect(await deps.isCompletelyDeleted("A")).toBe(false);
});
it("CAS filters operation ID, receipt, expected state and attempts", async () => {
  const { deps,query } = clients(); expect(await deps.transition(op,"processing")).toBe(true);
  for (const pair of [["id","op"],["receipt_hash","hash"],["status","ready"],["attempts",1]]) expect(query.eq).toHaveBeenCalledWith(...pair);
  query.maybeSingle.mockResolvedValue({ data: null, error: null }); expect(await deps.transition(op,"processing")).toBe(false);
});
it("reserves uniquely; only expired unsubmitted operations can be pruned", async () => {
  const { deps,query } = clients(); expect(await deps.insert(op)).toBe(true);
  expect(query.in).toHaveBeenCalledWith("status",["pending","verifying","ready"]);
  query.insert.mockResolvedValue({ error: { code: "23505" } }); expect(await deps.insert(op)).toBe(false);
  query.insert.mockResolvedValue({ error: { code: "connection" } }); await expect(deps.insert(op)).rejects.toThrow("operation unavailable");
});
it("store lookup/cancel and transport failures stay explicit", async () => {
  const { deps,query,admin,auth } = clients();
  query.maybeSingle.mockResolvedValue({ data: op, error: null }); expect(await deps.get("hash")).toEqual(op);
  expect(await deps.cancel(op)).toBe(true);
  query.maybeSingle.mockResolvedValue({ data: null, error: {} }); await expect(deps.get("hash")).rejects.toThrow();
  admin.auth.admin.deleteUser.mockResolvedValue({ error: {} }); await expect(deps.deleteUser("A")).rejects.toThrow();
  auth.auth.verifyOtp.mockResolvedValue({ data: { user: null, session: null }, error: {} }); expect(await deps.verifyCode("a@test","000000")).toBeNull();
});
