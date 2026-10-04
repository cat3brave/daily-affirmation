import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "./supabaseServer";
import type { DeletionActor, DeletionDependencies, DeletionOperation } from "./accountDeletion";

export const DELETION_COOKIE = "account-deletion-receipt";
export function deletionConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const origin = process.env.ACCOUNT_DELETION_ORIGIN;
  if (process.env.ACCOUNT_DELETION_ENABLED !== "true" ||
      process.env.ACCOUNT_DELETION_DB_VERIFIED !== "true" ||
      process.env.ACCOUNT_DELETION_EMAIL_OTP_VERIFIED !== "true" ||
      !url || !publicKey || !secret || !origin) return null;
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || parsed.username || parsed.password) return null;
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") return null;
    if (!["https:", "http:"].includes(parsed.protocol)) return null;
    return { url, publicKey, secret, origin };
  } catch { return null; }
}

export const receiptHash = (receipt: string) => createHash("sha256").update(receipt).digest("hex");

export async function deletionActor(): Promise<DeletionActor | null> {
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user?.email || !data.user.email_confirmed_at) return null;
  const claims = await client.auth.getClaims();
  const sessionId = claims.data?.claims.session_id;
  if (claims.error || claims.data?.claims.sub !== data.user.id || typeof sessionId !== "string" || !sessionId) return null;
  return { id: data.user.id, email: data.user.email, sessionId };
}

export function deletionDependencies(config: NonNullable<ReturnType<typeof deletionConfiguration>>): DeletionDependencies {
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const admin = createClient(config.url, config.secret, options);
  // An isolated public client prevents the reauthentication session from replacing the user's cookie.
  const auth = () => createClient(config.url, config.publicKey, options);
  const operations = () => admin.from("account_deletion_operations");
  return {
    now: Date.now,
    async insert(op) {
      // Expired, unsubmitted proofs may be replaced; unknown/processing operations must be reconciled.
      const expired = await operations().delete().eq("user_id", op.user_id)
        .in("status", ["pending", "verifying", "ready"]).lt("expires_at", new Date().toISOString());
      if (expired.error) throw new Error("operation unavailable");
      const { error } = await operations().insert(op);
      if (error?.code === "23505") return false;
      if (error) throw new Error("operation unavailable");
      return true;
    },
    async get(hash) {
      const { data, error } = await operations().select("id,user_id,session_id,receipt_hash,status,attempts,expires_at,receipt_expires_at")
        .eq("receipt_hash", hash).maybeSingle();
      if (error) throw new Error("operation unavailable");
      return data as DeletionOperation | null;
    },
    async transition(op, status, patch = {}) {
      const { data, error } = await operations().update({ ...patch, status })
        .eq("id", op.id).eq("receipt_hash", op.receipt_hash).eq("status", op.status)
        .eq("attempts", op.attempts).select("id").maybeSingle();
      if (error) throw new Error("operation unavailable");
      return Boolean(data);
    },
    async cancel(op) {
      const { data, error } = await operations().delete().eq("id", op.id).eq("status", op.status)
        .in("status", ["pending", "ready"]).eq("receipt_hash", op.receipt_hash).select("id").maybeSingle();
      if (error) throw new Error("operation unavailable");
      return Boolean(data);
    },
    async sendCode(email) {
      const { error } = await auth().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      return !error;
    },
    async verifyCode(email, token) {
      const client = auth();
      const { data, error } = await client.auth.verifyOtp({ email, token, type: "email" });
      if (error || !data.user || !data.session) return null;
      const verifiedId = data.user.id;
      // Revoke the temporary reauthentication session, not all of the user's sessions.
      const signedOut = await client.auth.signOut({ scope: "local" });
      return signedOut.error ? null : verifiedId;
    },
    async deleteUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId, false);
      if (error) throw new Error("deletion result unknown");
    },
    async isCompletelyDeleted(userId) {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      // A timeout, generic 404 or user-session failure is never treated as absence.
      if (!error || error.code !== "user_not_found" || data.user) return false;
      for (const table of ["todos", "profiles", "bloom_logs", "favorite_affirmations", "three_good_things"]) {
        const result = await admin.from(table).select("id", { count: "exact", head: true })
          .eq(table === "profiles" ? "id" : "user_id", userId);
        if (result.error || result.count !== 0) return false;
      }
      return true;
    },
  };
}
