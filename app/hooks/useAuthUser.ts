import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";
import { ACCOUNT_DELETED_EVENT, isAccountDeleted, isDeletionStorageKey } from "../lib/deletedAccount";
import { removeUserLocalData } from "../lib/userLocalStorage";

export function useAuthUser(initialUser?: { id: string; email: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [userId, setUserId] = useState<string | null>(initialUser?.id ?? null);
  const [userEmail, setUserEmail] = useState<string | null>(initialUser?.email ?? null);
  const [isAuthChecked, setIsAuthChecked] = useState<boolean>(Boolean(initialUser));

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const leave = (deleted: boolean) => {
      if (!active) return;
      if (deleted) removeUserLocalData(userId);
      setUserId(null);
      setUserEmail(null);
      setIsAuthChecked(false);
      router.replace("/login");
    };
    const check = async () => {
      if (isAccountDeleted(userId)) { leave(true); return; }
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || data.user?.id !== userId) leave(false);
      } catch { leave(false); }
    };
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    const onStorage = (event: StorageEvent) => { if (isDeletionStorageKey(event.key, userId) && event.newValue === "true") leave(true); };
    const onDeleted = (event: Event) => { if ((event as CustomEvent).detail === userId) leave(true); };
    if (isAccountDeleted(userId)) leave(true);
    window.addEventListener("focus", check);
    window.addEventListener("storage", onStorage);
    window.addEventListener(ACCOUNT_DELETED_EVENT, onDeleted);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.removeEventListener("focus", check);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(ACCOUNT_DELETED_EVENT, onDeleted);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, supabase, userId]);

  useEffect(() => {
    if (initialUser) return;
    let isMounted = true;

    const fetchUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (error || !user) {
          router.replace("/login");
          return;
        }

        setUserId(user.id);
        setUserEmail(user.email ?? "");
        setIsAuthChecked(true);
      } catch (error) {
        console.error("ユーザー情報取得中に想定外のエラー:", error);

        if (isMounted) {
          router.replace("/login");
        }
      }
    };

    fetchUser();

    return () => {
      isMounted = false;
    };
  }, [router, supabase, initialUser]);

  return { supabase, userId, userEmail, isAuthChecked };
}
