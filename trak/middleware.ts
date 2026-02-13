import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";

const PUBLIC_PATHS = new Set([
  "/login",
  "/signup",
  "/auth/callback",
  "/favicon.ico",
  "/client",
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Fix for incorrect /app/* routes (e.g., /app/profile should be /profile)
  // This handles browser session restoration with old/incorrect URLs
  if (pathname.startsWith("/app/") && !pathname.startsWith("/api/")) {
    const correctedPath = pathname.replace("/app", "");
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = correctedPath;
    return NextResponse.redirect(redirectUrl);
  }

  // Allow Next internals & static
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/public/")
  ) {
    return NextResponse.next();
  }

  // API routes are handled in route handlers; skip middleware auth gating to avoid hot-path auth calls.
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Allow explicitly public pages
  if ([...PUBLIC_PATHS].some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Mutable response so we can set cookies
  const res = NextResponse.next({ request: { headers: req.headers } });

  // Supabase SSR client wired to middleware cookies API
  const supabaseEnv = getSupabaseEnv();
  if (!supabaseEnv.url || !supabaseEnv.anonKey) {
    return new NextResponse(
      `Missing Supabase configuration (middleware) path=${req.nextUrl.pathname}`,
      {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      }
    );
  }

  const supabase = createServerClient(
    supabaseEnv.url,
    supabaseEnv.anonKey,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set(name, "", { ...options, maxAge: 0 });
        },
      },
    }
  );

  // Middleware only performs a cheap session gate. Route handlers/components do authoritative auth via getUser().
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set(
      "redirectedFrom",
      req.nextUrl.pathname + req.nextUrl.search
    );
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|auth|api).*)"],
};
