/**
 * Request proxy (Next.js 16's replacement for middleware). Copied from Open
 * Senedd without its sign-in routes.
 *
 * Locale routing: internally every page sits under app/[lang].
 * - English pages live at the root of the English domain: unprefixed requests
 *   are rewritten to /en/..., and any /en/... URL is redirected to its
 *   unprefixed form.
 * - Welsh pages live under /cy. When the Welsh site has its own domain
 *   (NEXT_PUBLIC_CY_SITE_URL), they live at that domain's
 *   root instead: requests there are rewritten to /cy/..., and /cy/... on
 *   either domain is redirected to the Welsh domain's unprefixed form.
 */
import { NextResponse, type NextRequest } from "next/server";
import { CY_ORIGIN } from "@/i18n/config";

const CY_HOST = CY_ORIGIN ? new URL(CY_ORIGIN).host : null;
/**
 * Sections copied from opencouncil.wales that only make sense for Wales
 * (planning, LDPs, consultations, StatsWales performance, the Welsh postcode
 * finder and 2027 Welsh elections). Their pages stay in the code, unrouted.
 */
const WALES_ONLY = /^\/(planning|consultations|performance|find|elections|cabinets|issues)(\/|$)|^\/[a-z0-9-]+\/(planning|performance|money|area|issues)(\/|$)/;

export function proxy(req: NextRequest): NextResponse {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) return NextResponse.next();
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").toLowerCase();
  // OpenCouncils is English only: any Welsh address goes to its English page.
  if (pathname === "/cy" || pathname.startsWith("/cy/")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }
  if (WALES_ONLY.test(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/en/not-covered";
    return NextResponse.rewrite(url);
  }
  const isCyHost = CY_HOST !== null && host === CY_HOST;
  const cyPrefixed = pathname === "/cy" || pathname.startsWith("/cy/");

  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }

  if (CY_HOST) {
    if (cyPrefixed) return NextResponse.redirect(`${CY_ORIGIN}${pathname.slice(3) || "/"}${search}`, 308);
    if (isCyHost) {
      const url = req.nextUrl.clone();
      url.pathname = pathname === "/" ? "/cy" : `/cy${pathname}`;
      return NextResponse.rewrite(url);
    }
  } else if (cyPrefixed) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? "/en" : `/en${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    // Pages: everything except Next internals and files with an extension.
    "/((?!_next/|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
