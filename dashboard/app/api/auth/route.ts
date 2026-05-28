import { NextRequest, NextResponse } from "next/server";

const PASSWORD = process.env.DASHBOARD_PASSWORD ?? "1234";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));

  if (password !== PASSWORD) {
    return NextResponse.json({ error: "비밀번호가 틀렸습니다" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("auth_token", PASSWORD, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30일
    path: "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("auth_token");
  return res;
}
