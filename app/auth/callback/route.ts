import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    // 👇 ここに await を追加しました！
    const cookieStore = await cookies();

    // 最新の道具（@supabase/ssr）を使って通信パイプを準備
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set({ name, value: "", ...options });
          },
        },
      },
    );

    // 「仮のチケット」を「本物のカギ」に交換する
    await supabase.auth.exchangeCodeForSession(code);
  }

  // カギが手に入ったので、トップページ（ / ）へ案内する
  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
