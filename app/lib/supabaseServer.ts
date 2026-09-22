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
