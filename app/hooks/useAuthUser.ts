import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";

export function useAuthUser(initialUser?: { id: string; email: string }) {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [userId, setUserId] = useState<string | null>(initialUser?.id ?? null);
  const [userEmail, setUserEmail] = useState<string | null>(initialUser?.email ?? null);
  const [isAuthChecked, setIsAuthChecked] = useState<boolean>(Boolean(initialUser));

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
