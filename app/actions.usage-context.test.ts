// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
const cookies = vi.hoisted(() => ({ getAll: vi.fn(), set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => cookies }));
import { generateAffirmation, translateHarshVoice } from "./actions";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe.each([generateAffirmation, () => translateHarshVoice("keep private")])("real Supabase SDK with mock fetch", (call) => {
  it("uses the same cookie session for verified Auth and the argument-free POST RPC", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://context-test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-test-key");
    vi.stubEnv("GEMINI_API_KEY", "fake-gemini-key");
    // Opaque dummy session data only; no signing or independent JWT parsing.
    const session = { access_token: "opaque-test-user-token", refresh_token: "opaque-refresh",
      expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: "bearer",
      user: { id: "test-user", email: "test@example.test" } };
    cookies.getAll.mockReturnValue([{ name: "sb-context-test-auth-token",
      value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` }]);
    const events: string[] = [];
    const network = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer opaque-test-user-token");
      expect(headers.get("apikey")).toBe("public-test-key");
      if (url === "https://context-test.supabase.co/auth/v1/user") {
        events.push("auth");
        return Response.json(session.user);
      }
      expect(url).toBe("https://context-test.supabase.co/rest/v1/rpc/reserve_ai_usage");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe("{}");
      expect(headers.get("content-profile")).toBe("public");
      events.push("rpc");
      return Response.json([{ allowed: false, reason: "daily_limit", daily_remaining: 0,
        minute_remaining: 2, retry_at: "2026-10-18T15:00:00Z" }]);
    });
    vi.stubGlobal("fetch", network);
    await expect(call()).resolves.toMatchObject({ status: "usage_limited", reason: "daily_limit" });
    expect(events).toEqual(["auth", "rpc"]);
    expect(network).toHaveBeenCalledTimes(2);
  });
});
