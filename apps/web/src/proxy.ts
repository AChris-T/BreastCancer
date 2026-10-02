import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";
const API_ORIGIN = new URL(API_URL).origin;
// Extra origins signed file URLs can come from (e.g. the R2/S3 bucket host), space-separated.
const FILE_ORIGINS = process.env.FILE_ORIGINS ?? "";

/**
 * Strict Content Security Policy with a per-request nonce, plus the other
 * security headers. Scripts run only if Next.js stamped them with the nonce.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes are needed by React; style injection can't run code.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${API_ORIGIN} ${FILE_ORIGINS}`.trim(),
    "font-src 'self'",
    `connect-src 'self' ${API_ORIGIN}${isDev ? " ws:" : ""}`,
    `frame-src ${API_ORIGIN} ${FILE_ORIGINS}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Only when the API is on HTTPS; otherwise it would break a plain-HTTP local API.
    ...(!isDev && API_ORIGIN.startsWith("https:") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=()");
  if (!isDev) response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // Share links carry their secret in the path; keep it out of referrers and caches.
  if (request.nextUrl.pathname.startsWith("/s/")) {
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
