import { NextRequest, NextResponse } from "next/server";

const ATTENDANCE_HOST = "attendance.vapeustad.com";

function isInternalAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/sw.js") ||
    pathname.startsWith("/offline.html") ||
    pathname.includes(".")
  );
}

export function middleware(req: NextRequest) {
  const host = req.headers.get("host")?.split(":")[0]?.toLowerCase() || "";
  const { pathname } = req.nextUrl;

  if (host !== ATTENDANCE_HOST) {
    return NextResponse.next();
  }

  if (pathname === "/manifest.json") {
    const url = req.nextUrl.clone();
    url.pathname = "/attendance-manifest.json";
    return NextResponse.rewrite(url);
  }

  if (isInternalAsset(pathname)) {
    return NextResponse.next();
  }

  if (pathname === "/" || pathname === "") {
    const url = req.nextUrl.clone();
    url.pathname = "/staff-attendance";
    return NextResponse.rewrite(url);
  }

  if (pathname === "/attendance") {
    const url = req.nextUrl.clone();
    url.pathname = "/staff-attendance";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
