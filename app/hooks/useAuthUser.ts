import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import { ACCOUNT_DELETED_EVENT, isAccountDeleted, isDeletionStorageKey } from "../lib/deletedAccount";
import { removeUserLocalData } from "../lib/userLocalStorage";

type Owner = { id: string; email: string };
export function useAuthUser(initialUser?: Owner) {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [state, setState] = useState(() => ({ owner: initialUser ?? null, generation: 0 }));
  const current = useRef({ owner: (initialUser?.id ?? null) as string | null, generation: 0, checked: Boolean(initialUser), observed: Boolean(initialUser), active: true });
  const request = useRef(0);
  const mismatch = useRef<(owner: string | null) => void>(() => undefined);

  // Restore the lifetime before descendant passive effects run during StrictMode
  // replay. Otherwise initial graph/garden loads can see a disposed boundary.
  useLayoutEffect(() => {
    current.current.active = true;
    return () => { current.current.active = false; request.current += 1; };
  }, []);

  useEffect(() => {
    current.current.active = true;
    const invalidate = (owner: string | null) => {
      request.current += 1;
      current.current = { owner, generation: current.current.generation + 1, checked: false, observed: true, active: true };
      setState({ owner: null, generation: current.current.generation });
    };
    const check = async () => {
      const number = ++request.current;
      const generation = current.current.generation;
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!current.current.active || number !== request.current || generation !== current.current.generation) return;
        const user = error ? null : data.user;
        if (!user || isAccountDeleted(user.id)) {
          if (user && isAccountDeleted(user.id)) removeUserLocalData(user.id);
          invalidate(null);
          router.replace("/login");
          return;
        }
        if (current.current.owner !== user.id) invalidate(user.id);
        current.current.checked = true;
        setState((previous) => previous.owner?.id === user.id && previous.owner.email === (user.email ?? "") && previous.generation === current.current.generation
          ? previous : { owner: { id: user.id, email: user.email ?? "" }, generation: current.current.generation });
      } catch (error) {
        if (!current.current.active || number !== request.current || generation !== current.current.generation) return;
        console.error("ユーザー情報取得中に想定外のエラー:", error);
        invalidate(null);
        router.replace("/login");
      }
    };
    // Do not start/await another Auth call under Supabase's callback lock.
    let timer: ReturnType<typeof setTimeout> | undefined;
    mismatch.current = (owner) => {
      if (!current.current.active) return;
      invalidate(owner);
      if (timer) clearTimeout(timer);
      if (!owner) router.replace("/login");
      else timer = setTimeout(() => { if (current.current.active) void check(); }, 0);
    };
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const owner = session?.user.id ?? null;
      if (owner === current.current.owner && (owner !== null || current.current.observed)) return;
      mismatch.current(owner);
    });
    const deleted = () => {
      const owner = current.current.owner;
      if (!owner) return;
      removeUserLocalData(owner);
      invalidate(null);
      router.replace("/login");
    };
    const onFocus = () => { void check(); };
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    const onStorage = (event: StorageEvent) => {
      if (current.current.owner && isDeletionStorageKey(event.key, current.current.owner) && event.newValue === "true") deleted();
    };
    const onDeleted = (event: Event) => { if ((event as CustomEvent).detail === current.current.owner) deleted(); };
    if (current.current.owner && isAccountDeleted(current.current.owner)) deleted();
    else if (!current.current.checked) void check();
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    window.addEventListener(ACCOUNT_DELETED_EVENT, onDeleted);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      current.current.active = false;
      request.current += 1;
      if (timer) clearTimeout(timer);
      listener.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ACCOUNT_DELETED_EVENT, onDeleted);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, supabase]);

  const isCurrent = useCallback(() => current.current.active && current.current.checked &&
    current.current.generation === state.generation && current.current.owner === state.owner?.id,
  [state]);
  const isLogoutCurrent = useCallback(() => current.current.active && (
    (current.current.generation === state.generation && current.current.owner === state.owner?.id) ||
    (current.current.generation === state.generation + 1 && current.current.owner === null)
  ), [state]);
  const onOwnerMismatch = useCallback((owner: string | null) => mismatch.current(owner), []);
  return useMemo(() => ({ onOwnerMismatch, supabase, userId: state.owner?.id ?? null, userEmail: state.owner?.email ?? null,
    isAuthChecked: Boolean(state.owner), authGeneration: state.generation, isCurrent, isLogoutCurrent }), [onOwnerMismatch, supabase, state, isCurrent, isLogoutCurrent]);
}
