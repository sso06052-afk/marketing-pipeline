import { NextRequest, NextResponse } from "next/server";

const PASSWORD = process.env.DASHBOARD_PASSWORD ?? "1234";
const COOKIE = "auth_token";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 로그인 페이지·API는 통과
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE)?.value;
  if (token === PASSWORD) {
    return NextResponse.next();
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
