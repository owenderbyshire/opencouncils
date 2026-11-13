import type { LdpRecord, LdpStage } from "@data/curated/ldps";
import type { Locale } from "@/i18n/config";
import { formatDate } from "@/i18n/format";

/** The stages a new plan passes through, in order, for the timeline. */
export const STAGE_ORDER: LdpStage[] = ["review", "delivery-agreement", "candidate-sites", "preferred-strategy", "deposit", "submitted", "examination", "adopted"];

/** "2026-03" as "March 2026", "2026-03-12" as "12 March 2026"; anything else as the authority wrote it. */
export function planDate(locale: Locale, s: string | null): string {
  if (!s) return "";
  if (/^\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}$/.test(s)) return formatDate(locale, `${s}-01`, "month");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return formatDate(locale, s);
  return s;
}

/** The plan period has ended (by the end of its final year). */
export function periodEnded(l: LdpRecord, today: string): boolean {
  return Number(today.slice(0, 4)) > l.adopted.periodEnd;
}

/** A replacement plan is being written. */
export function replacementUnderWay(l: LdpRecord): boolean {
  return !["none", "adopted"].includes(l.replacement.stage);
}

/** "Consulting on the draft plan, expected March 2027", from the stage names given. */
export function nextStepText(
  locale: Locale,
  l: LdpRecord,
  t: { nextStages: Record<LdpStage, string>; nextAt: string },
): string {
  const r = l.replacement;
  if (!r.nextStage || !t.nextStages[r.nextStage]) return "";
  const step = t.nextStages[r.nextStage];
  return r.nextDate ? t.nextAt.replace("{step}", step).replace("{date}", planDate(locale, r.nextDate)) : step;
}

/**
 * The figure to show for a measure. A plan split across several documents
 * can give one in each: the one stated on more pages wins, and if documents
 * disagree with equal support none is shown.
 */
export function shownFact<T extends { kind: string; key: string; value: number; mentions: number }>(facts: T[], kind: string, key: string): T | undefined {
  const c = facts.filter((f) => f.kind === kind && f.key === key);
  if (!c.length) return undefined;
  const top = Math.max(...c.map((f) => f.mentions));
  const best = c.filter((f) => f.mentions === top);
  return new Set(best.map((f) => f.value)).size === 1 ? best[0] : undefined;
}

interface SiteLike {
  kind: string;
  ref: string | null;
  name: string;
  homes: number | null;
  hectares: number | null;
  page: number;
}

const siteKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const firstRef = (ref: string | null) => siteKey((ref ?? "").split(/,|\band\b|&/)[0]);

/**
 * One row per site. A plan often lists a site twice: in a policy and in a
 * table, or under its own reference and again under a combined one
 * ("MG9 (2)" and "MG9 (2), MG10, SP2 (3)"). Rows with the same name, or the
 * same first reference, are the same site; the fuller one is kept.
 */
export function mergeSameSites<T extends SiteLike>(sites: T[]): T[] {
  const score = (x: T) => (x.homes !== null ? 2 : 0) + (x.hectares !== null ? 1 : 0);
  const out: T[] = [];
  for (const s of sites) {
    const i = out.findIndex(
      (o) => o.kind === s.kind && ((firstRef(o.ref) && firstRef(o.ref) === firstRef(s.ref)) || siteKey(o.name) === siteKey(s.name)),
    );
    if (i < 0) out.push(s);
    else if (score(s) > score(out[i]) || (score(s) === score(out[i]) && s.page < out[i].page)) out[i] = s;
  }
  return out;
}
