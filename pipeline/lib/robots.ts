/**
 * robots.txt, honoured for the web pages the pipeline reads from council
 * sites (Cabinet membership pages and forward plans). A page a council's
 * robots.txt closes to us is not read: the job says so and moves on.
 *
 * Rules follow RFC 9309: the group naming our crawler is used if there is
 * one, otherwise the group for every crawler ("*"); the longest matching
 * path wins, and Allow wins a tie. "*" matches any run of characters and
 * "$" the end of the address.
 */
import { fetchText, USER_AGENT } from "./http";

/** The name councils would use for us in a robots.txt group: the first word of the User-Agent. */
export const ROBOTS_AGENT = USER_AGENT.split("/")[0].trim() || "OpenCouncilBot";

/**
 * Hosts read whatever their robots.txt says, because the owner has agreed it
 * (November 2026): Merthyr Tydfil's and Conwy's ModernGov sites close every
 * page to every crawler, including the meeting records these councils publish
 * for the public. Nothing else belongs here without the owner's agreement.
 */
export const ROBOTS_OVERRIDE_HOSTS: ReadonlySet<string> = new Set(["democracy.merthyr.gov.uk", "modgovpub-eng.secure.conwy.gov.uk"]);

interface Rule {
  allow: boolean;
  pattern: string;
}

export interface RobotsRules {
  /** Whether a path (with its query string) may be read. */
  allows(pathAndQuery: string): boolean;
  /** Seconds the site asks crawlers to leave between requests, if it says. */
  crawlDelay: number | null;
  /** The site's robots.txt could not be read, so nothing is known about what it allows: its pages are left alone. */
  unknown?: true;
}

const ALLOW_ALL: RobotsRules = { allows: () => true, crawlDelay: null };
const NOT_KNOWN: RobotsRules = { allows: () => false, crawlDelay: null, unknown: true };

/**
 * The rules a reply to a request for robots.txt gives. No robots.txt (a 4xx
 * answer, or a web page where the file should be) closes nothing. A site that
 * cannot say (no answer, or a server error) is left alone, and marked as not
 * known so that nobody is told its robots.txt closes it.
 */
export function rulesFromReply(reply: { ok: true; text: string } | { ok: false; status: number | null }): RobotsRules {
  if (reply.ok) return /^\s*</.test(reply.text) ? ALLOW_ALL : parseRobots(reply.text);
  return reply.status !== null && reply.status >= 400 && reply.status < 500 ? ALLOW_ALL : NOT_KNOWN;
}

function matches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const source = body
    .split("*")
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${source}${anchored ? "$" : ""}`).test(path);
}

/** How specific a rule is: its length without wildcards, as crawlers compare them. */
const weight = (pattern: string) => pattern.replace(/\*/g, "").length;

export function parseRobots(text: string, agent = ROBOTS_AGENT): RobotsRules {
  const groups: Array<{ agents: string[]; rules: Rule[]; crawlDelay: number | null }> = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const i = line.indexOf(":");
    if (i < 0) continue;
    const field = line.slice(0, i).trim().toLowerCase();
    const value = line.slice(i + 1).trim();
    if (field === "user-agent") {
      // Consecutive User-agent lines share one group of rules.
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "allow" || field === "disallow") {
      // "Disallow:" with nothing after it closes nothing.
      if (value) current.rules.push({ allow: field === "allow", pattern: value.startsWith("/") || value.startsWith("*") ? value : `/${value}` });
    } else if (field === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }
  const name = agent.toLowerCase();
  const named = groups.filter((g) => g.agents.some((a) => a !== "*" && name.includes(a)));
  const chosen = named.length ? named : groups.filter((g) => g.agents.includes("*"));
  if (!chosen.length) return ALLOW_ALL;
  const rules = chosen.flatMap((g) => g.rules);
  const crawlDelay = chosen.map((g) => g.crawlDelay).find((d) => d !== null) ?? null;
  return {
    crawlDelay,
    allows(pathAndQuery: string) {
      let best: Rule | null = null;
      for (const r of rules) {
        if (!matches(r.pattern, pathAndQuery)) continue;
        if (!best || weight(r.pattern) > weight(best.pattern) || (weight(r.pattern) === weight(best.pattern) && r.allow && !best.allow)) best = r;
      }
      return best ? best.allow : true;
    },
  };
}

const cache = new Map<string, Promise<RobotsRules>>();

/** A site's rules, read once per run. */
export function robotsFor(origin: string): Promise<RobotsRules> {
  let rules = cache.get(origin);
  if (!rules) {
    rules = fetchText(`${origin}/robots.txt`, { accept: "text/plain,*/*;q=0.5", retries: 1, timeoutMs: 20_000, fresh: true }).then(rulesFromReply);
    cache.set(origin, rules);
  }
  return rules;
}

/**
 * - allowed: the site's robots.txt lets the pipeline read the page, or the owner has agreed the site is read regardless
 * - closed: its robots.txt asks the pipeline to stay out
 * - unknown: its robots.txt could not be read, so the page is left alone too
 */
export type Permission = "allowed" | "closed" | "unknown";

export async function permission(url: string): Promise<Permission> {
  const u = new URL(url);
  if (ROBOTS_OVERRIDE_HOSTS.has(u.host)) return "allowed";
  const rules = await robotsFor(u.origin);
  if (rules.unknown) return "unknown";
  return rules.allows(`${u.pathname}${u.search}`) ? "allowed" : "closed";
}

/** Whether the pipeline may read a page. */
export async function mayRead(url: string): Promise<boolean> {
  return (await permission(url)) === "allowed";
}
