import { type NextRequest, NextResponse } from "next/server";

const LOGIN_NOTICE = "请登陆后使用";

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => {
    return cookie.name.startsWith("sb-") && cookie.name.endsWith("-auth-token");
  });
}

function buildLoginRedirect(request: NextRequest) {
  const loginUrl = request.nextUrl.clone();
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("notice", LOGIN_NOTICE);
  loginUrl.searchParams.set("next", nextPath);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAuthCookie = hasSupabaseAuthCookie(request);

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
    pathname.startsWith(prefix)
  );

  if (isProtectedPath && !hasAuthCookie) {
    return buildLoginRedirect(request);
  }

  const authPaths = ["/login", "/register"];
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path));

  if (isAuthPath && hasAuthCookie) {
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
