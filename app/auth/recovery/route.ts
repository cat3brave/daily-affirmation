import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

function recoveryRedirect(path: "/reset-password" | "/reset-password/invalid") {
  // A relative Location keeps the browser's origin, including behind a proxy
  // or Next's development hostname normalization. Never derive a destination
  // from Host, forwarded headers or user-provided URL parameters.
  return new NextResponse(null, { status: 303, headers: {
    Location: path,
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  } });
}

// A failed exchange must never fall back to a pre-existing session.
export async function GET(request: NextRequest) {
  const failure = recoveryRedirect("/reset-password/invalid");
  const code = request.nextUrl.searchParams.get("code");
  if (!code || request.nextUrl.searchParams.has("error")) return failure;

  const response = recoveryRedirect("/reset-password");
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return failure;
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookies, headers) {
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
        },
      },
    });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user || !data.session) return failure;
    return response;
  } catch {
    return failure;
  }
}
