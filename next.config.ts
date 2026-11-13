import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // HTTPS only, for two years, once the site is served on its own domain.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // A content security policy that blocks plugins, framing by other sites,
  // <base> tag hijacking and forms posting elsewhere, and upgrades any stray
  // http:// request. Scripts and styles are left to the defaults because the
  // framework uses inline code; pages show no
  // user-written HTML.
  {
    key: "Content-Security-Policy",
    value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'self'; upgrade-insecure-requests",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Data the pipeline writes. Pages refresh when the pipeline revalidates the
  // data's tags (only for what changed), so the clock is a safety net and a
  // week is enough. Every regeneration is an ISR write, which Vercel bills.
  // Anything that depends on today's date keeps "days" or "hours".
  cacheLife: {
    pipeline: {
      stale: 300,
      revalidate: 60 * 60 * 24 * 7,
      expire: 60 * 60 * 24 * 30,
    },
  },
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
