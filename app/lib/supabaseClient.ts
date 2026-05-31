import { createBrowserClient } from "@supabase/ssr";

function getRequiredPublicEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`${name} is required to initialize Supabase.`);
  }

  return value;
}

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    getRequiredPublicEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    getRequiredPublicEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  );
}
