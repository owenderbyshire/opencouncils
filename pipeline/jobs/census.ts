/**
 * Platform census: finds where every UK council publishes its committee
 * records, and whether its ModernGov data service answers.
 *
 *   pnpm pipeline census                  # every current council outside Wales
 *   pnpm pipeline census --council woking # one council
 *   pnpm pipeline census --all            # include the Welsh councils too
 *   pnpm pipeline census --limit 40       # the 40 least recently checked
 *
 * For each council it:
 *   1. finds the council's website from GOV.UK's "Find your local council"
 *      page (its gov-uk-slug in the register);
 *   2. reads the home page and looks for links to a committee system
 *      (ModernGov's mg*.aspx / ie*.aspx pages, CMIS, or a democracy subdomain);
 *   3. failing that, tries the usual ModernGov addresses on the council's domain
 *      and on moderngov.co.uk;
 *   4. checks the ModernGov web service with GetCouncillorsByWard.
 *
 * Results go to pipeline_state under "census" (one entry per council, kept
 * between runs). scripts/export-platforms.mjs writes them to
 * data/curated/platforms.json, which the site and the other jobs read.
 * Polite: one council at a time per host, a few requests each.
 */
import { CURRENT_COUNCILS, type RegisterEntry } from "../../data/curated/councils";
import { fetchText } from "../lib/http";
import type { Job } from "../lib/job";

export type Platform = "moderngov" | "cmis" | "other" | "unknown";

export interface CensusEntry {
  platform: Platform;
  base: string | null;
  website: string | null;
  feedOk: boolean;
  /** How the base was found: "homepage", "guess" or "manual". */
  via: string | null;
  note: string | null;
  checked: string;
}

const STATE_KEY = "census";

/**
 * The council's website, from GOV.UK. A district's page lists its county
 * council too, county first, so the link chosen is the one naming this council.
 */
export function pickWebsite(html: string, c: Pick<RegisterEntry, "short" | "name">): string | null {
  const links = [...html.matchAll(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>\s*Go to ([^<]*?)\s*website/gi)].map((m) => ({ url: m[1].replace(/\/+$/, ""), text: m[2].toLowerCase() }));
  if (!links.length) return null;
  const key = (x: string) => x.toLowerCase().replace(/^the /, "").replace(/ (borough|district|city|county|metropolitan borough) council$/, "").replace(/ council$/, "");
  const want = [key(c.short), key(c.name)];
  const match = links.find((l) => want.some((w) => l.text.includes(w)));
  if (match) return match.url;
  return links.length === 1 ? links[0].url : null;
}

async function websiteFromGovUk(c: RegisterEntry): Promise<string | null> {
  if (!c.govUkSlug) return null;
  const r = await fetchText(`https://www.gov.uk/find-local-council/${c.govUkSlug}`, { retries: 1, timeoutMs: 20_000 });
  return r.ok ? pickWebsite(r.text, c) : null;
}

/** The ModernGov base of a link: everything before the mg*.aspx / ie*.aspx page. */
export function moderngovBaseOf(link: string): string | null {
  const m = link.match(/^(https?:\/\/[^"'\s<>]+?)\/(?:mg|ie)[A-Za-z]+\.aspx/i);
  return m ? m[1].replace(/\/+$/, "") : null;
}

/** Committee-system links on a page. */
export function findSystems(html: string, pageUrl: string): { moderngov: string[]; cmis: string[]; democracy: string[] } {
  const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((m) => {
    try {
      return new URL(m[1].replace(/&amp;/g, "&"), pageUrl).toString();
    } catch {
      return null;
    }
  }).filter((x): x is string => Boolean(x));
  const uniq = (xs: Array<string | null>) => [...new Set(xs.filter((x): x is string => Boolean(x)))];
  return {
    moderngov: uniq(links.map(moderngovBaseOf).concat(links.filter((l) => /moderngov/i.test(l)).map((l) => new URL(l).origin))),
    cmis: uniq(links.filter((l) => /\/cmis/i.test(l)).map((l) => l.replace(/(\/cmis[^/]*)\/.*$/i, "$1"))),
    democracy: uniq(links.filter((l) => /\/\/(democracy|committees?|meetings|democratic|councillors|modgov|mgov)\./i.test(l)).map((l) => new URL(l).origin)),
  };
}

/** Addresses ModernGov sites usually sit at, for a council domain like woking.gov.uk. */
export function guesses(website: string | null, c: RegisterEntry): string[] {
  const out: string[] = [];
  if (website) {
    const host = new URL(website).hostname.replace(/^www\./, "");
    // The commonest ModernGov addresses first; a long list made the first census run for over an hour.
    for (const sub of ["democracy", "moderngov", "committees", "modgov", "meetings", "democratic"]) out.push(`https://${sub}.${host}`);
    out.push(`https://www.${host}/moderngov`);
  }
  const short = c.short.toLowerCase().replace(/^the /, "").replace(/&/g, "and").replace(/[^a-z]/g, "");
  out.push(`https://${short}.moderngov.co.uk`);
  return [...new Set(out)];
}

/** Whether a base's ModernGov web service answers with councillors. */
async function feedAnswers(base: string): Promise<boolean> {
  const r = await fetchText(`${base}/mgWebService.asmx/GetCouncillorsByWard`, { accept: "text/xml", retries: 0, timeoutMs: 12_000 });
  return r.ok && /<councillorsbyward|<ward>|<councillor>/i.test(r.text);
}

/** Whether a base looks like a ModernGov site at all (even with the data service closed). */
async function looksLikeModernGov(base: string): Promise<boolean> {
  const r = await fetchText(`${base}/mgListCommittees.aspx`, { retries: 0, timeoutMs: 15_000 });
  return r.ok && /mgCommitteeDetails|ModernGov|mgListCommittees/i.test(r.text);
}

export async function censusOne(c: RegisterEntry, known?: CensusEntry): Promise<CensusEntry> {
  const checked = new Date().toISOString().slice(0, 10);
  // A base set by hand is kept; only its feed is checked again.
  if (known?.via === "manual" && known.base) {
    return { ...known, feedOk: known.platform === "moderngov" ? await feedAnswers(known.base) : false, checked };
  }
  const website = await websiteFromGovUk(c);
  const notes: string[] = [];
  let systems = { moderngov: [] as string[], cmis: [] as string[], democracy: [] as string[] };
  if (website) {
    const home = await fetchText(website, { retries: 1, timeoutMs: 25_000 });
    if (home.ok) systems = findSystems(home.text, home.url);
    else notes.push(`home page: ${home.error.slice(0, 60)}`);
  } else notes.push("no website from GOV.UK");

  // Democracy subdomains are often ModernGov even when the home page links to a landing page.
  for (const base of [...systems.moderngov, ...systems.democracy]) {
    if (await feedAnswers(base)) return { platform: "moderngov", base, website, feedOk: true, via: "homepage", note: null, checked };
  }
  for (const base of systems.moderngov) {
    if (await looksLikeModernGov(base)) return { platform: "moderngov", base, website, feedOk: false, via: "homepage", note: "data service closed", checked };
  }
  for (const base of guesses(website, c)) {
    if (await feedAnswers(base)) return { platform: "moderngov", base, website, feedOk: true, via: "guess", note: null, checked };
  }
  if (systems.cmis.length) return { platform: "cmis", base: systems.cmis[0], website, feedOk: false, via: "homepage", note: null, checked };
  if (systems.democracy.length) return { platform: "other", base: systems.democracy[0], website, feedOk: false, via: "homepage", note: "democracy site, system not recognised", checked };
  return { platform: "unknown", base: null, website, feedOk: false, via: null, note: notes.join("; ") || null, checked };
}

export const censusJob: Job = {
  name: "census",
  description: "Finds each UK council's committee system and checks its ModernGov data service",
  async run(ctx) {
    const state = (await ctx.getState<Record<string, CensusEntry>>(STATE_KEY)) ?? {};
    const only = typeof ctx.args.council === "string" ? ctx.args.council : null;
    const limit = Number(ctx.args.limit) || Infinity;
    // Stop in time for the workflow to save what was found (its limit is two hours).
    const deadline = Date.now() + (Number(ctx.args.minutes) || 95) * 60_000;
    let todo = CURRENT_COUNCILS.filter((c) => (only ? c.id === only : ctx.args.all || c.nation !== "Wales"));
    // --shared: only councils whose base another council also holds (two-tier mix-ups).
    if (ctx.args.shared) {
      const counts = new Map<string, number>();
      for (const e of Object.values(state)) if (e.base) counts.set(e.base, (counts.get(e.base) ?? 0) + 1);
      todo = todo.filter((c) => (counts.get(state[c.id]?.base ?? "") ?? 0) > 1 || (c.county && state[c.county] && !state[c.county].base));
    }
    if (only && !todo.length) throw new Error(`Unknown council: ${only}`);
    // Least recently checked first, so a limited run works through the list.
    todo = todo.sort((a, b) => (state[a.id]?.checked ?? "").localeCompare(state[b.id]?.checked ?? "")).slice(0, limit);

    let i = 0;
    const save = () => ctx.setState(STATE_KEY, state);
    // Councils are on different hosts, so a few can be checked at once; http.ts limits each host.
    const worker = async () => {
      while (i < todo.length && Date.now() < deadline) {
        const c = todo[i++];
        try {
          state[c.id] = await censusOne(c, state[c.id]);
          ctx.count(`platform ${state[c.id].platform}${state[c.id].feedOk ? " (feed ok)" : ""}`);
        } catch (err) {
          ctx.warn(`${c.id}: ${err instanceof Error ? err.message : String(err)}`);
          ctx.count("errors");
        }
        if (i % 20 === 0) await save();
      }
    };
    await Promise.all(Array.from({ length: 10 }, worker));
    await save();
    ctx.stats.checked = Math.min(i, todo.length);
    if (i < todo.length) ctx.warn(`Stopped at the time limit: ${todo.length - i} councils left for the next run`);
    ctx.stats.held = Object.keys(state).length;
  },
};
