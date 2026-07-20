/**
 * Edge middleware — enforcement layer 1 (SPEC §6): a COARSE gate, never the
 * boundary. Database sessions cannot be verified at the edge, so this only
 * checks cookie presence and redirects anonymous visitors to /signin; layers
 * 2–4 (guards, scoped client, RLS) do the real enforcement per request.
 */
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = [/^\/signin(?:\/|$)/, /^\/verify(?:\/|$)/, /^\/api\/auth\//, /^\/invite\//];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => p.test(pathname))) return NextResponse.next();

  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");
  if (hasSession) return NextResponse.next();

  const signin = new URL("/signin", req.url);
  return NextResponse.redirect(signin);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
