/**
 * Polite HTTP client for the pipeline.
 *
 * - Identifies itself honestly with a User-Agent that links to the data page.
 * - Limits concurrency and spaces requests per host so we never hammer the
 *   councils' servers.
 * - Retries transient failures (network errors, 429, 5xx) with backoff.
 * - Optionally caches responses on disk (PIPELINE_HTTP_CACHE=1) so parsers can
 *   be re-run during development without re-fetching.
 *
 * A failed fetch returns a typed error result. Callers must treat "failed to
 * fetch" as unknown, never as evidence that the upstream record is missing.
 */
import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { ACTIVE_COUNCILS } from "../../data/curated/councils";
import { PIPELINE_RELAY_HOSTS, RELAY_HOSTS as RELAY_HOSTS_ALL } from "../../src/lib/relay-hosts";

export const USER_AGENT =
  process.env.PIPELINE_USER_AGENT ??
  `OpenCouncilBot/1.0 (+${process.env.SITE_URL || "https://www.datblygu.cymru"}; feedback@datblygu.cymru)`;

export type FetchResult =
  /** `fetchedAt` is when the page was read from the source: now, or when the cached copy was saved. */
  | {
      ok: true;
      status: number;
      url: string;
      text: string;
      fromCache: boolean;
      fetchedAt: Date;
    }
  | { ok: false; status: number | null; url: string; error: string };

interface HostState {
  active: number;
  queue: Array<() => void>;
  lastStart: number;
}

const hosts = new Map<string, HostState>();

const DEFAULT_CONCURRENCY = Number(process.env.PIPELINE_HOST_CONCURRENCY ?? 2);
const DEFAULT_SPACING_MS = Number(process.env.PIPELINE_HOST_SPACING_MS ?? 400);
const CACHE_DIR = process.env.PIPELINE_HTTP_CACHE_DIR ?? ".cache/http";
const CACHE_ON =
  process.env.PIPELINE_HTTP_CACHE === "1" ||
  process.env.PIPELINE_OFFLINE === "1";
/**
 * Offline mode (development only): never touch the network. Cache misses are
 * appended to .cache/missing-urls.txt so they can be fetched some other way.
 */
const OFFLINE = process.env.PIPELINE_OFFLINE === "1";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function acquire(host: string): Promise<() => void> {
  let st = hosts.get(host);
  if (!st) {
    st = { active: 0, queue: [], lastStart: 0 };
    hosts.set(host, st);
  }
  const state = st;
  if (state.active >= DEFAULT_CONCURRENCY) {
    await new Promise<void>((resolve) => state.queue.push(resolve));
  }
  state.active++;
  const wait = state.lastStart + DEFAULT_SPACING_MS - Date.now();
  if (wait > 0) await sleep(wait);
  state.lastStart = Date.now();
  return () => {
    state.active--;
    const next = state.queue.shift();
    if (next) next();
  };
}

export function cachePath(url: string) {
  const h = createHash("sha1").update(url).digest("hex");
  return path.join(CACHE_DIR, h.slice(0, 2), `${h}.txt`);
}

export interface FetchOptions {
  accept?: string;
  acceptLanguage?: string;
  timeoutMs?: number;
  retries?: number;
  /** Bypass the dev disk cache for this request. */
  fresh?: boolean;
  method?: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
}

/**
 * Session cookies per host. Some ModernGov pages (registers of
 * interests) set a session cookie and redirect to themselves; without the
 * cookie the redirect never ends, so redirects are followed by hand and
 * cookies are sent back to the host that set them.
 */
const cookieJar = new Map<string, Map<string, string>>();

function storeCookies(host: string, res: Response) {
  const set =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [];
  if (!set.length) return;
  const jar = cookieJar.get(host) ?? new Map<string, string>();
  for (const c of set) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
  cookieJar.set(host, jar);
}

/**
 * Some council sites refuse GitHub's machines (src/lib/relay-hosts.ts). Those
 * requests go through the website's relay, which runs in London, when the
 * pipeline knows where the website is.
 */
const RELAY = process.env.PIPELINE_RELAY !== "0" && process.env.SITE_URL && process.env.REVALIDATE_SECRET ? `${process.env.SITE_URL.replace(/\/$/, "")}/api/relay` : null;

function relayFor(host: string): boolean {
  return RELAY !== null && PIPELINE_RELAY_HOSTS.has(host);
}

/** Same shape as fetch: the council's reply, rebuilt from the relay's. */
async function viaRelay(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(RELAY!, {
    method: "POST",
    signal: init.signal,
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.REVALIDATE_SECRET}` },
    body: JSON.stringify({ url, method: init.method ?? "GET", body: typeof init.body === "string" ? init.body : null, headers: init.headers }),
  });
  if (res.status !== 200 || !res.headers.get("x-relay-status")) {
    const why = await res.text().catch(() => "");
    throw new Error(`relay refused (${res.status}): ${why.slice(0, 200)}`);
  }
  const headers = new Headers({ "content-type": res.headers.get("content-type") ?? "" });
  const location = res.headers.get("x-relay-location");
  if (location) headers.set("location", location);
  for (const c of JSON.parse(res.headers.get("x-relay-set-cookie") ?? "[]") as string[]) headers.append("set-cookie", c);
  const status = Number(res.headers.get("x-relay-status"));
  // Response can't carry a body with these statuses.
  const empty = status === 204 || status === 304 || (status >= 300 && status < 400);
  if (empty) await res.body?.cancel();
  return new Response(empty ? null : res.body, { status, headers });
}

/** For the probe: what a URL returns when fetched through the relay, if the relay will fetch it. */
export async function relayCheck(url: string): Promise<string> {
  if (!RELAY) return "no relay";
  try {
    const res = await viaRelay(preferHttps(url), { headers: { "User-Agent": USER_AGENT, Accept: "*/*" }, signal: AbortSignal.timeout(60_000) });
    const bytes = new Uint8Array(await res.arrayBuffer());
    return `HTTP ${res.status}${bytes[0] === 0x25 && bytes[1] === 0x50 ? " pdf" : ""}`;
  } catch (e) {
    return (e as Error).message.slice(0, 80);
  }
}

/**
 * Council ModernGov sites serve everything over HTTPS, but some of their web
 * services hand back document links starting http://, which can redirect in a
 * loop. Those links are read over HTTPS from the start.
 */
const HTTPS_HOSTS = new Set(
  [...ACTIVE_COUNCILS.flatMap((c) => [c.moderngovBase, c.welshBase]), ...RELAY_HOSTS_ALL].flatMap((u) => {
    if (!u) return [];
    try {
      return [u.includes("://") ? new URL(u).host : u];
    } catch {
      return [];
    }
  }),
);

export function preferHttps(url: string): string {
  if (!url.startsWith("http://")) return url;
  const u = new URL(url);
  if (!HTTPS_HOSTS.has(u.host)) return url;
  u.protocol = "https:";
  return u.toString();
}

async function fetchFollowing(
  url: string,
  opts: FetchOptions,
  signal: AbortSignal,
): Promise<Response> {
  let current = preferHttps(url);
  let method = opts.method ?? "GET";
  let body = opts.body;
  for (let hop = 0; hop < 10; hop++) {
    const host = new URL(current).host;
    const jar = cookieJar.get(host);
    const res = await (relayFor(host) ? viaRelay : fetch)(current, {
      method,
      body,
      signal,
      redirect: "manual",
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          opts.accept ??
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": opts.acceptLanguage ?? "en-GB,en;q=0.9,cy;q=0.8",
        ...(jar?.size
          ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") }
          : {}),
        ...(opts.headers ?? {}),
      },
    });
    storeCookies(host, res);
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      current = new URL(location, current).toString();
      if (res.status !== 307 && res.status !== 308) {
        method = "GET";
        body = undefined;
      }
      continue;
    }
    return res;
  }
  throw new Error(`Too many redirects from ${url}`);
}

export async function fetchText(
  url: string,
  opts: FetchOptions = {},
): Promise<FetchResult> {
  const cacheKey = opts.method === "POST" ? `${url}#${opts.body ?? ""}` : url;
  if (CACHE_ON && !opts.fresh) {
    try {
      const file = cachePath(cacheKey);
      const text = await readFile(file, "utf8");
      const { mtime } = await stat(file);
      return {
        ok: true,
        status: 200,
        url,
        text,
        fromCache: true,
        fetchedAt: mtime,
      };
    } catch {
      /* not cached */
    }
  }

  if (OFFLINE) {
    await mkdir(CACHE_DIR, { recursive: true });
    await appendFile(
      path.join(CACHE_DIR, "..", "missing-urls.txt"),
      `${cacheKey}\n`,
      "utf8",
    );
    return { ok: false, status: null, url, error: "offline: not in cache" };
  }

  const host = new URL(url).host;
  const retries = opts.retries ?? 3;
  let lastError = "";
  let lastStatus: number | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const release = await acquire(host);
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      opts.timeoutMs ?? 45_000,
    );
    try {
      const res = await fetchFollowing(url, opts, controller.signal);
      lastStatus = res.status;
      if (res.ok) {
        const fetchedAt = new Date();
        const text = await res.text();
        if (CACHE_ON) {
          const p = cachePath(cacheKey);
          await mkdir(path.dirname(p), { recursive: true });
          await writeFile(p, text, "utf8");
        }
        return {
          ok: true,
          status: res.status,
          url: res.url || url,
          text,
          fromCache: false,
          fetchedAt,
        };
      }
      // Keep the start of the reply: a refusal usually says why.
      const why = (await res.text().catch(() => "")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
      lastError = why ? `HTTP ${res.status}: ${why}` : `HTTP ${res.status}`;
      // Client errors other than rate limiting are not worth retrying.
      if (res.status !== 429 && res.status < 500) break;
      const retryAfter = Number(res.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0)
        await sleep(Math.min(retryAfter, 60) * 1000);
    } catch (err) {
      lastError =
        err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    } finally {
      clearTimeout(timer);
      release();
    }
    if (attempt < retries)
      await sleep(1000 * 2 ** attempt + Math.random() * 500);
  }
  return {
    ok: false,
    status: lastStatus,
    url,
    error: lastError || "unknown error",
  };
}

export async function fetchJson<T = unknown>(
  url: string,
  opts: FetchOptions = {},
): Promise<
  { ok: true; data: T } | { ok: false; error: string; status: number | null }
> {
  const r = await fetchText(url, { accept: "application/json", ...opts });
  if (!r.ok) return { ok: false, error: r.error, status: r.status };
  try {
    return { ok: true, data: JSON.parse(r.text) as T };
  } catch (err) {
    return {
      ok: false,
      error: `Invalid JSON: ${(err as Error).message}`,
      status: r.status,
    };
  }
}

/** Downloads a binary file (a spreadsheet, say). Cached like text in development. */
export async function fetchBytes(
  url: string,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; error: string }> {
  const cacheKey = `${url}#bytes`;
  if (CACHE_ON) {
    try {
      return {
        ok: true,
        bytes: new Uint8Array(await readFile(cachePath(cacheKey))),
      };
    } catch {
      /* not cached */
    }
  }
  if (OFFLINE) return { ok: false, error: "offline: not in cache" };
  const host = new URL(url).host;
  let lastError = "";
  // Retries rate limiting, server errors and network failures, as fetchText does.
  for (let attempt = 0; attempt <= 3; attempt++) {
    const release = await acquire(host);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const res = await fetchFollowing(url, { accept: "*/*" }, controller.signal);
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        if (CACHE_ON) {
          const p = cachePath(cacheKey);
          await mkdir(path.dirname(p), { recursive: true });
          await writeFile(p, bytes);
        }
        return { ok: true, bytes };
      }
      lastError = `HTTP ${res.status}`;
      await res.body?.cancel();
      if (res.status !== 429 && res.status < 500) break;
      const retryAfter = Number(res.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) await sleep(Math.min(retryAfter, 60) * 1000);
    } catch (err) {
      lastError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    } finally {
      clearTimeout(timer);
      release();
    }
    if (attempt < 3) await sleep(1000 * 2 ** attempt + Math.random() * 500);
  }
  return { ok: false, error: lastError || "unknown error" };
}