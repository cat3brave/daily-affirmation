import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../lib/supabaseServer";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const loginUrl = new URL("/login", requestUrl.origin);

  if (!code) {
    return NextResponse.redirect(loginUrl);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("OAuth code exchange failed:", error);
      return NextResponse.redirect(loginUrl);
    }
  } catch (error) {
    console.error("OAuth callback failed:", error);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL("/", requestUrl.origin));
}
