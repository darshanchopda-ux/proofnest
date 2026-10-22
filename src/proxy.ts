import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";

const LOGIN = "/auth/sign-in";
const neonAuthProxy = auth.middleware({ loginUrl: LOGIN });

// Optimistic check only: every page, server action and route handler re-checks the session
// and flat ownership itself (see src/lib/dal.ts).
export default async function proxy(request: NextRequest) {
  const response = await neonAuthProxy(request);
  const location = response?.headers.get("location");
  // Send people back to the page they asked for once they've signed in.
  if (location && new URL(location, request.url).pathname === LOGIN) {
    const url = new URL(LOGIN, request.url);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/flats/:path*", "/account", "/join/:path*"],
};
