/**
 * Called by the data pipeline after it changes the database, so cached pages
 * refresh as soon as they are next visited instead of waiting for their
 * cache lifetime to run out.
 *
 *   POST /api/revalidate
 *   Authorization: Bearer $REVALIDATE_SECRET
 *   { "tags": ["meetings", "meeting:cardiff:12345", "councillors"] }
 */
import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import type { NextRequest } from "next/server";

const TAG =
  /^(meetings|councillors|committees|reference|planning|consultations|topics|councils|meeting:[a-z-]{2,40}:\d{1,10})$/;

function authorised(header: string | null): boolean {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: NextRequest) {
  if (!authorised(request.headers.get("authorization"))) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    tags?: unknown;
  } | null;
  const tags = Array.isArray(body?.tags)
    ? [
        ...new Set(
          body.tags.filter(
            (t): t is string => typeof t === "string" && TAG.test(t),
          ),
        ),
      ].slice(0, 500)
    : [];
  for (const tag of tags) revalidateTag(tag, "max");
  return Response.json({ revalidated: tags });
}
