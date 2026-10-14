import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("justio_auth")?.value;
  const secret = process.env.JUSTIO_SECRET_TOKEN;

  if (!token || !secret || token !== secret) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // /triagem e /api/triagem: chat de triagem fechado ao público (só com login).
  matcher: ["/dashboard/:path*", "/triagem", "/api/triagem", "/api/audiencia/:path*"],
};
