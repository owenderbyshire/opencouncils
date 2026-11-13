/**
 * Fetches a page from one of a few council sites on the pipeline's behalf
 * (src/lib/relay-hosts.ts). Protected by the revalidation secret.
 *
 *   POST /api/relay  Authorization: Bearer $REVALIDATE_SECRET
 *   { "url": "...", "method": "GET", "body": null, "headers": { ... } }
 *
 * The reply's body is the council's body; its status, redirect location and
 * cookies come back in x-relay-* headers. Redirects are not followed, so the
 * pipeline keeps its own cookie handling. GET ?token=...&url=... is for
 * checking a host by hand and returns a short report.
 */
import { timingSafeEqual } from "node:crypto";
import { connection, type NextRequest } from "next/server";
import { RELAY_HOSTS } from "@/lib/relay-hosts";

export const maxDuration = 60;

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

function allowed(raw: unknown): URL | null {
  if (typeof raw !== "string") return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && RELAY_HOSTS.has(u.host) ? u : null;
  } catch {
    return null;
  }
}

const PASS = ["user-agent", "accept", "accept-language", "cookie", "content-type", "soapaction"];

async function relay(url: URL, method: string, body: string | null, headers: Record<string, string>): Promise<Response> {
  const upstream = await fetch(url, {
    method,
    body: method === "GET" ? undefined : body ?? undefined,
    redirect: "manual",
    headers: Object.fromEntries(Object.entries(headers).filter(([k]) => PASS.includes(k.toLowerCase()))),
    signal: AbortSignal.timeout(55_000),
  });
  const out = new Headers({
    "x-relay-status": String(upstream.status),
    "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  const location = upstream.headers.get("location");
  if (location) out.set("x-relay-location", location);
  const cookies = upstream.headers.getSetCookie?.() ?? [];
  if (cookies.length) out.set("x-relay-set-cookie", JSON.stringify(cookies));
  return new Response(upstream.body, { status: 200, headers: out });
}

export async function POST(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ") || !same(header.slice(7), process.env.REVALIDATE_SECRET ?? "")) return new Response("Not found", { status: 404 });
  const req = (await request.json().catch(() => null)) as { url?: unknown; method?: unknown; body?: unknown; headers?: unknown } | null;
  const url = allowed(req?.url);
  if (!url) return Response.json({ error: "host not allowed" }, { status: 400 });
  const method = req?.method === "POST" ? "POST" : "GET";
  const headers = req?.headers && typeof req.headers === "object" ? (req.headers as Record<string, string>) : {};
  try {
    return await relay(url, method, typeof req?.body === "string" ? req.body : null, headers);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  await connection();
  const q = new URL(request.url).searchParams;
  if (!same(q.get("token") ?? "", process.env.REVALIDATE_SECRET ?? "")) return new Response("Not found", { status: 404 });
  const url = allowed(q.get("url"));
  if (!url) return Response.json({ error: "host not allowed" }, { status: 400 });
  const started = Date.now();
  try {
    const r = await relay(url, "GET", null, { "user-agent": "OpenCouncilBot/1.0 (+https://opencouncil.wales)" });
    const buf = Buffer.from(await r.arrayBuffer());
    return Response.json({
      status: Number(r.headers.get("x-relay-status")),
      location: r.headers.get("x-relay-location"),
      type: r.headers.get("content-type"),
      bytes: buf.length,
      ms: Date.now() - started,
      start: buf.subarray(0, 600).toString("latin1"),
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message, cause: String((e as { cause?: unknown }).cause ?? ""), ms: Date.now() - started }, { status: 502 });
  }
}
