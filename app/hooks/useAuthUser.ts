import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "../lib/supabaseClient";

export function useAuthUser() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState<boolean>(false);

  useEffect(() => {
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
  }, [router, supabase]);

  return { supabase, userId, userEmail, isAuthChecked };
}
