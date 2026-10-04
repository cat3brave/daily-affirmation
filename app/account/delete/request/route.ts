import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { advanceDeletion, prepareDeletion, type DeletionResult } from "../../../lib/accountDeletion";
import { DELETION_COOKIE, deletionActor, deletionConfiguration, deletionDependencies, receiptHash } from "../../../lib/accountDeletionServer";

export const runtime = "nodejs";
const reply = (result: DeletionResult, status = 200) => NextResponse.json(result, {
  status, headers: { "Cache-Control": "private, no-store" },
});

export async function POST(request: Request) {
  const config = deletionConfiguration();
  if (!config) return reply({ status: "unavailable" }, 503);
  if (request.headers.get("origin") !== config.origin ||
      request.headers.get("sec-fetch-site") === "cross-site") return reply({ status: "invalid" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ status: "invalid" }, 400);
  try {
    const text = await request.text();
    if (text.length > 2048) return reply({ status: "invalid" }, 400);
    const input = JSON.parse(text);
    if (!input || !["prepare", "verify", "delete", "status", "cancel"].includes(input.action)) return reply({ status: "invalid" }, 400);
    if (Object.keys(input).some(key => !["action", "token", "confirmed"].includes(key))) return reply({ status: "invalid" }, 400);
    if (input.token !== undefined && typeof input.token !== "string") return reply({ status: "invalid" }, 400);
    if (input.confirmed !== undefined && typeof input.confirmed !== "boolean") return reply({ status: "invalid" }, 400);
    const jar = await cookies();
    const deps = deletionDependencies(config);
    if (input.action === "prepare") {
      const actor = await deletionActor();
      if (!actor) return reply({ status: "auth_required" }, 401);
      const receipt = randomBytes(32).toString("hex");
      const result = await prepareDeletion(deps, actor, { id: randomUUID(), receiptHash: receiptHash(receipt) });
      if (result.status === "pending") jar.set(DELETION_COOKIE, receipt, {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict",
        path: "/account/delete", maxAge: 3600,
      });
      return reply(result);
    }
    const receipt = jar.get(DELETION_COOKIE)?.value;
    if (!receipt || !/^[a-f0-9]{64}$/.test(receipt)) return reply({ status: "expired" });
    const actor = input.action === "status" ? null : await deletionActor();
    const result = await advanceDeletion(deps, receiptHash(receipt), actor, input);
    if (result.status === "cancelled") jar.set(DELETION_COOKIE, "", { path: "/account/delete", maxAge: 0 });
    return reply(result);
  } catch {
    // Keep the receipt and local data: a transport error can occur after the delete committed.
    return reply({ status: "unknown" }, 503);
  }
}
