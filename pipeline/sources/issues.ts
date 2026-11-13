/**
 * Issues: what looks like the same piece of business, followed across meetings. A report often
 * goes to a scrutiny committee, then Cabinet, then full Council, under
 * slightly different titles ("Reference from Cabinet: ...", "Budget Proposals
 * 2027/28"). Items are grouped when their titles share most of their
 * meaningful words and they fall within 18 months of each other.
 */

import { isProceduralItem } from "./moderngov";

export interface IssueItem {
  agendaItemId: number;
  meetingId: number;
  committeeId: number;
  date: string;
  title: string;
}

/** Procedural items that recur at every meeting and are never an issue. */
const PROCEDURAL =
  /^(apolog|ymddiheur|declaration|disclosures? of|datgan|minutes?\b|cofnod|to (approve|confirm|receive|sign)\b.*\bminutes|urgent|any other business|public questions?|questions? (from|by|to) (the )?(public|members|leader|cabinet)|exclusion|gwahardd|announcements?|cyhoeddiadau|chair'?s? (announcements|report|remarks)|(vice[- ]?)?chair(man|person)?\b|is-?gadeirydd|cadeirydd|forward work ?programme|work ?programme|rhaglen waith|petitions?|date of (the )?next|matters arising|welcome|introductions?|to receive|items? (for|of) (urgent|information|deferral|withdrawal)|part [12i]+\b|rhan [12]\b|access to meetings|simultaneous translation|cyfieithu|live event|webcast|livestream|attendance|presenoldeb|action (sheet|log|tracker)|housekeeping|exempt|confidential|appointment of (members|representatives))/i;

/** The same check the meetings pipeline uses for routine items, plus the patterns above. */
const STOP = new Set(
  "a an and the of to for in on at by with from into is be are as or that this these those its it our your their any all report reports update updates proposed proposal proposals draft final review annual council councils cabinet committee committees scrutiny reference referral ref recommendation recommendations consider consideration approval approve paper item items matter matters regarding concerning following re cab cyngor adroddiad pwyllgor".split(
    " ",
  ),
);

/** Lower case, without the routing words councils add ("Reference from Cabinet:"), split into meaningful words. */
export function issueWords(title: string): string[] {
  const t = title
    .toLowerCase()
    .replace(/&amp;/g, "&")
    .replace(/\b(ref(erence)?|referral|recommendations?)\s+(from|of)\s+(the\s+)?[a-z&' ]{0,60}?(committee|cabinet|council|panel|board|forum)\b/g, " ")
    .replace(/\breport\s+of\s+the\s+[a-z&' ]{0,80}?(officer|director|executive|manager|head|leader)\b[^:–-]*/g, " ")
    .replace(/\b\d{1,2}(st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{4}\b/g, " ")
    .replace(/(\d{4})\s*[/-]\s*(\d{2,4})/g, (_, a: string, b: string) => ` y${a}${b.slice(-2)} `)
    .replace(/[^a-z0-9 ]+/g, " ");
  const out = new Set<string>();
  for (const w of t.split(/\s+/)) {
    if (w.length < 3 && !/^\d/.test(w)) continue;
    if (STOP.has(w)) continue;
    out.add(w.replace(/(ies)$/, "y").replace(/(?<=[a-z]{3})s$/, ""));
  }
  return [...out];
}

export function isProcedural(title: string): boolean {
  const t = title.trim().replace(/^(item\s+)?\d+(\.\d+)?[.)]?\s*[-–:]?\s*/i, "");
  return PROCEDURAL.test(t) || isProceduralItem(t);
}

const MAX_GAP_DAYS = 548;
const days = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

/** Overlap of two word sets: shared words over the smaller set, so a short title inside a longer one still matches. */
function overlap(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / Math.min(a.size, b.size);
}

/**
 * Whether two items look like the same business: at least three shared
 * meaningful words making up 70% of the shorter title (or every word of a
 * two-word title), at least one shared rare word, and no rare word in the
 * shorter title that the longer one lacks ("Taxi Licensing Code of Practice"
 * is not "Licensing Sub-Committee Code of Practice").
 */
function similar(a: Set<string>, b: Set<string>, isRare: (w: string) => boolean): boolean {
  if (a.size < 2 || b.size < 2) return false;
  let shared = 0;
  let rareShared = 0;
  for (const w of a)
    if (b.has(w)) {
      shared++;
      if (isRare(w)) rareShared++;
    }
  if (!rareShared) return false;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const w of small) if (isRare(w) && !large.has(w)) return false;
  const o = overlap(a, b);
  return (shared >= 3 && o >= 0.7) || (shared >= 2 && o === 1);
}

/**
 * Groups items into issues. Every pair of items in an issue must look like
 * the same business (complete linkage: no chains where A matches B and B
 * matches C but A and C are unrelated), sit in different meetings, and fall
 * within 18 months of the issue's first item. Issues need two or more
 * meetings.
 */
export function groupIssues(items: IssueItem[]): IssueItem[][] {
  const usable = items.filter((i) => !isProcedural(i.title)).sort((a, b) => a.date.localeCompare(b.date) || a.agendaItemId - b.agendaItemId);
  const words = usable.map((i) => new Set(issueWords(i.title)));
  const freq = new Map<string, number>();
  for (const ws of words) for (const w of ws) freq.set(w, (freq.get(w) ?? 0) + 1);
  const common = Math.max(25, usable.length * 0.02);
  const isRare = (w: string) => (freq.get(w) ?? 0) <= common;

  // Candidate clusters for each item come from its rare words.
  const clusters: number[][] = [];
  const byWord = new Map<string, Set<number>>();
  usable.forEach((item, i) => {
    const candidates = new Set<number>();
    for (const w of words[i]) if (isRare(w)) for (const c of byWord.get(w) ?? []) candidates.add(c);
    let joined = -1;
    for (const c of [...candidates].sort((x, y) => x - y)) {
      const members = clusters[c];
      if (days(usable[members[0]].date, item.date) > MAX_GAP_DAYS) continue;
      if (members.some((m) => usable[m].meetingId === item.meetingId)) continue;
      if (members.every((m) => similar(words[m], words[i], isRare))) {
        joined = c;
        break;
      }
    }
    if (joined < 0) {
      joined = clusters.length;
      clusters.push([]);
    }
    clusters[joined].push(i);
    for (const w of words[i]) if (isRare(w)) byWord.set(w, (byWord.get(w) ?? new Set()).add(joined));
  });

  return clusters
    .map((c) => c.map((i) => usable[i]))
    .filter((g) => new Set(g.map((i) => i.meetingId)).size >= 2);
}
