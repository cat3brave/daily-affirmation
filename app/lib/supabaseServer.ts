import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSupabaseConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase server configuration is unavailable.");
  }

  return { url, anonKey };
}

export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseConfiguration();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. Auth checks can still read them.
        }
      },
    },
  });
}

// Cookie内のsessionを信用せず、Authサーバーで検証した最小限の情報だけ返す。
export async function getAuthenticatedContext() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { supabase, user: { id: data.user.id, email: data.user.email ?? "" } };
  } catch {
    return null;
  }
}

// 既存の呼び出し側へは本人情報だけを返す。クライアントはサーバー内部に留める。
export async function getAuthenticatedUser(): Promise<{ id: string; email: string } | null> {
  return (await getAuthenticatedContext())?.user ?? null;
}
