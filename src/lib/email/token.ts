/**
 * Signed links for email: lets someone stop the weekly email from the link in
 * it without signing in. The token is an HMAC of the purpose and user ID, so
 * it can't be forged or reused for another subscriber.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string | null {
  return (
    process.env.EMAIL_TOKEN_SECRET || process.env.REVALIDATE_SECRET || null
  );
}

export function emailToken(purpose: string, id: string): string | null {
  const s = secret();
  return s
    ? createHmac("sha256", s).update(`${purpose}:${id}`).digest("base64url")
    : null;
}

export function checkEmailToken(
  purpose: string,
  id: string,
  token: string,
): boolean {
  const expected = emailToken(purpose, id);
  if (!expected) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
