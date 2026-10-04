// State machine only. Supabase, cookies and privileged credentials stay in the server adapter.
export type DeletionState = "pending" | "verifying" | "ready" | "processing" | "unknown" | "succeeded";
export type DeletionOperation = {
  id: string;
  user_id: string;
  session_id: string;
  receipt_hash: string;
  status: DeletionState;
  attempts: number;
  expires_at: string;
  receipt_expires_at: string;
};
export type DeletionActor = { id: string; email: string; sessionId: string };
export type DeletionResult = {
  status: DeletionState | "unavailable" | "auth_required" | "invalid" | "expired" | "busy" | "error" | "cancelled";
  operationId?: string;
  cleanupUserId?: string;
};
export interface DeletionDependencies {
  now(): number;
  insert(operation: DeletionOperation): Promise<boolean>;
  get(receiptHash: string): Promise<DeletionOperation | null>;
  transition(operation: DeletionOperation, status: DeletionState, patch?: Partial<DeletionOperation>): Promise<boolean>;
  cancel(operation: DeletionOperation): Promise<boolean>;
  sendCode(email: string): Promise<boolean>;
  verifyCode(email: string, token: string): Promise<string | null>;
  deleteUser(userId: string): Promise<void>;
  isCompletelyDeleted(userId: string): Promise<boolean>;
}

export async function prepareDeletion(
  deps: DeletionDependencies, actor: DeletionActor, identity: { id: string; receiptHash: string },
): Promise<DeletionResult> {
  const operation: DeletionOperation = {
    id: identity.id, user_id: actor.id, session_id: actor.sessionId,
    receipt_hash: identity.receiptHash, status: "pending", attempts: 0,
    expires_at: new Date(deps.now() + 10 * 60_000).toISOString(),
    receipt_expires_at: new Date(deps.now() + 60 * 60_000).toISOString(),
  };
  if (!await deps.insert(operation)) return { status: "busy" };
  // Reserve the operation before sending email; a competing request must not resend.
  if (!await deps.sendCode(actor.email)) {
    await deps.cancel(operation);
    return { status: "error" };
  }
  return { status: "pending", operationId: operation.id };
}

export async function advanceDeletion(
  deps: DeletionDependencies,
  receiptHash: string,
  actor: DeletionActor | null,
  input: { action: "verify" | "delete" | "status" | "cancel"; token?: string; confirmed?: boolean },
): Promise<DeletionResult> {
  const op = await deps.get(receiptHash);
  if (!op || Date.parse(op.receipt_expires_at) <= deps.now()) return { status: "expired" };
  const result = (status: DeletionResult["status"]): DeletionResult => ({ status, operationId: op.id });

  // The receipt permits status lookup only after Auth has gone. It cannot authorize deletion.
  if (input.action === "status") {
    if (op.status === "succeeded") return { ...result("succeeded"), cleanupUserId: op.user_id };
    if (op.status === "processing" || op.status === "unknown") {
      if (await deps.isCompletelyDeleted(op.user_id)) {
        await deps.transition(op, "succeeded");
        return { ...result("succeeded"), cleanupUserId: op.user_id };
      }
      return result("unknown");
    }
    return result(Date.parse(op.expires_at) <= deps.now() ? "expired" : op.status);
  }

  if (!actor) return result("auth_required");
  if (op.user_id !== actor.id || op.session_id !== actor.sessionId) return result("invalid");
  if (Date.parse(op.expires_at) <= deps.now()) return result("expired");
  if (input.action === "cancel") {
    if (!["pending", "ready"].includes(op.status)) return result("busy");
    return result(await deps.cancel(op) ? "cancelled" : "busy");
  }
  if (input.action === "verify") {
    if (op.status !== "pending" || op.attempts >= 5 || !/^\d{6,10}$/.test(input.token ?? "")) return result("invalid");
    const patch = { attempts: op.attempts + 1 };
    if (!await deps.transition(op, "verifying", patch)) return result("busy");
    const verifying = { ...op, ...patch, status: "verifying" as const };
    let verifiedId: string | null = null;
    try { verifiedId = await deps.verifyCode(actor.email, input.token!); } catch { /* Fail closed. */ }
    // Recheck expiry after the network request. A different account never grants proof.
    if (verifiedId !== actor.id || Date.parse(op.expires_at) <= deps.now()) {
      await deps.transition(verifying, "pending");
      return result("invalid");
    }
    const saved = await deps.transition(verifying, "ready", {
      expires_at: new Date(Math.min(Date.parse(op.expires_at), deps.now() + 5 * 60_000)).toISOString(),
    });
    return result(saved ? "ready" : "busy");
  }
  if (!input.confirmed || op.status !== "ready") return result("invalid");
  if (!await deps.transition(op, "processing")) return result("busy");
  const processing = { ...op, status: "processing" as const };
  try {
    // Only the server-recorded, reauthenticated owner is ever passed to Admin Auth.
    await deps.deleteUser(op.user_id);
    if (await deps.isCompletelyDeleted(op.user_id)) {
      await deps.transition(processing, "succeeded");
      return { ...result("succeeded"), cleanupUserId: op.user_id };
    }
  } catch { /* A lost response is not evidence of rollback. Never automatically repeat deleteUser. */ }
  try { await deps.transition(processing, "unknown"); } catch { /* processing remains reconcilable */ }
  return result("unknown");
}
