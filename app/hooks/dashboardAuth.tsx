"use client";

import { createContext, useCallback, useContext, useLayoutEffect, useRef } from "react";
import type { useAuthUser } from "./useAuthUser";

export const DashboardAuthContext = createContext<ReturnType<typeof useAuthUser> | null>(null);

// The boundary invalidates synchronously in the auth callback, before React unmounts.
// A local lifetime also protects components removed by tab navigation.
export function useDashboardOperation(owner?: string | null) {
  const auth = useContext(DashboardAuthContext);
  const lifetime = useRef(0);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    lifetime.current += 1;
    return () => { mounted.current = false; lifetime.current += 1; };
  }, [owner]);
  const capture = useCallback(() => {
    const version = lifetime.current;
    return () => mounted.current && lifetime.current === version &&
      (!auth || (auth.isCurrent() && (owner === undefined || auth.userId === owner)));
  }, [auth, owner]);
  return { capture, auth };
}

export async function verifyDashboardOwner(
  auth: ReturnType<typeof useAuthUser> | null,
  supabase: ReturnType<typeof useAuthUser>["supabase"],
  owner: string,
  current: () => boolean,
) {
  const { data, error } = await supabase.auth.getUser().catch((error) => {
    if (current()) auth?.onOwnerMismatch(null);
    throw error;
  });
  if (!current()) return false;
  if (error || data.user?.id !== owner) {
    auth?.onOwnerMismatch(error ? null : data.user?.id ?? null);
    throw new Error("ログイン情報を確認できませんでした。");
  }
  return true;
}
