import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let authenticated = false;

  try {
    if (url && anonKey) {
      const supabase = createServerClient(url, anonKey, {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            const previousCookies = response.cookies.getAll();
            response = NextResponse.next({ request });
            previousCookies.forEach((cookie) => response.cookies.set(cookie));
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      });
      const { data, error } = await supabase.auth.getUser();
      authenticated = !error && Boolean(data.user);
    }
  } catch {
    // 設定不足や認証サービスの障害でも、保護された画面は返さない。
  }

  const pathname = request.nextUrl.pathname;
  const protectedRoute = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const destination = !authenticated && (protectedRoute || pathname === "/")
    ? "/login"
    : authenticated && (pathname === "/" || pathname === "/login")
      ? "/dashboard"
      : null;

  if (destination) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = destination;
    redirectUrl.search = "";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    redirectResponse.headers.set("Cache-Control", "private, no-store");
    return redirectResponse;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

// 対象を明示し、OAuth callbackと静的アセットには認証処理を適用しない。
export const config = { matcher: ["/", "/login", "/dashboard/:path*"] };
