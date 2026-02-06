import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const LOGIN_NOTICE = "请登陆后使用";

function buildLoginRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`
  );
  url.searchParams.set("notice", LOGIN_NOTICE);
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedPrefixes = [
    "/novels",
    "/chapters",
    "/notes",
    "/settings",
    "/ai-",
    "/export",
    "/papers",
    "/paper-sections",
    "/paper-ai",
    "/paper-export",
  ];

  const isProtectedPath = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix)
  );

  if (isProtectedPath && !user) {
    return buildLoginRedirect(request);
  }

  const authPaths = ["/login", "/register"];
  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isAuthPath && user) {
    const url = request.nextUrl.clone();
    const next = request.nextUrl.searchParams.get("next");
    if (next && next.startsWith("/")) {
      const nextUrl = new URL(next, request.url);
      url.pathname = nextUrl.pathname;
      url.search = nextUrl.search;
    } else {
      url.pathname = "/novels";
      url.search = "";
    }
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
