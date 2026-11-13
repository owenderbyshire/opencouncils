/**
 * Checks that what an AI summary says can be found in the papers it was
 * given. Any sentence with a number, or (in English) a run of capitalised
 * words such as a person's or organisation's name, that doesn't appear in the
 * source text is removed. Conservative: a correct sentence written with a
 * number in another form ("£2.5 million" for "£2,500,000") is removed too.
 *
 * A summary's English and Welsh say the same things in the same order, so
 * `groundedPair` removes a sentence from both languages when either fails,
 * and the two stay the same length.
 */

import { splitSentences } from "../../src/lib/summary";

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];

export interface Source {
  /** Lower case, with thousands separators removed. */
  text: string;
}

export function prepareSource(raw: string): Source {
  return {
    text: raw
      .toLowerCase()
      .replace(/(\d),(?=\d{3}\b)/g, "$1")
      .replace(/[’]/g, "'")
      .replace(/\s+/g, " "),
  };
}

function numberFound(n: string, src: Source, figureOnly = false): boolean {
  const norm = n.replace(/,/g, "").replace(/\.0+$/, "");
  const re = new RegExp(`(?<![\\d.])${norm.replace(".", "\\.")}(?![\\d])`);
  if (re.test(src.text)) return true;
  const i = Number(norm);
  return !figureOnly && Number.isInteger(i) && i >= 0 && i <= 20 && new RegExp(`\\b${WORDS[i]}\\b`).test(src.text);
}

/** Runs of two or more capitalised words, allowing "of", "and", "the" and "y" inside: "James Gibson-Watt", "Bro Morgannwg". */
const NAME = /\b[A-Z][\p{L}'’-]+(?:\s+(?:of|and|the|y|a|ac)\s+[A-Z][\p{L}'’-]+|\s+[A-Z][\p{L}'’-]+)+/gu;

/**
 * Words that take a capital only because they start a sentence ("The
 * Planning Committee approved…"), and days and months ("On Monday Cabinet
 * agreed…"). They are not part of a name, so they are dropped from the front of a run before it is
 * looked for in the papers.
 */
const DATES = "monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december";
const LEADING = new Set(
  `${DATES} the a an this that these those it its in on at for from by with after before during under over as of and but or our their his her also when while once then there here`.split(" "),
);

/**
 * The words councils use for their own bodies and posts. A run made only of
 * these ("Full Council", "Planning Committee", "Cabinet Member") names the
 * council's structure, not a person or organisation, so it needs no support.
 */
const STRUCTURE = new Set(
  `full council councils county borough city community town committee committees sub-committee sub-committees cabinet scrutiny planning licensing audit governance standards democratic services overview and of the chair chairs vice-chair vice deputy leader member members cabinet officer officers monitoring chief executive director head mayor lord leaders group panel board meeting meetings annual extraordinary special ordinary ${DATES}`
    .split(" "),
);

/**
 * The parts of a capitalised run that have to be found in the papers. A
 * possessive splits a run in two ("Cardiff Council's Planning Committee"),
 * and each part is checked on its own.
 */
export function namesToCheck(run: string): string[] {
  const parts: string[][] = [[]];
  for (const raw of run.replace(/[’]/g, "'").split(/\s+/)) {
    const possessive = /'s$/i.test(raw);
    parts[parts.length - 1].push(raw.replace(/'s$/i, ""));
    if (possessive) parts.push([]);
  }
  const out: string[] = [];
  for (const words of parts) {
    while (words.length && LEADING.has(words[0].toLowerCase())) words.shift();
    // A single capitalised word is never treated as a name: too many ordinary words start sentences.
    if (words.filter((w) => /^[A-Z]/.test(w)).length < 2) continue;
    if (words.every((w) => STRUCTURE.has(w.toLowerCase()))) continue;
    out.push(words.join(" ").toLowerCase());
  }
  return out;
}

export function sentenceSupported(sentence: string, src: Source, checkNames: boolean): boolean {
  for (const m of sentence.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    // Money and percentages must match as figures: "£3" isn't supported by "three".
    const before = sentence[m.index! - 1] ?? "";
    const after = sentence.slice(m.index! + m[0].length, m.index! + m[0].length + 9).toLowerCase();
    const figureOnly = before === "£" || /^\s?(%|m\b|bn\b|k\b|million|billion|per cent|y cant|miliwn|biliwn)/.test(after);
    if (!numberFound(m[0], src, figureOnly)) return false;
  }
  if (checkNames)
    for (const m of sentence.matchAll(NAME)) {
      for (const name of namesToCheck(m[0])) if (!src.text.includes(name)) return false;
    }
  return true;
}

/** A text split into sentences, the way the grounding check reads it. */
export const sentences = splitSentences;

/** The text with unsupported sentences removed, and how many were removed. */
export function grounded(text: string, src: Source, checkNames: boolean): { text: string; removed: number } {
  if (!text.trim()) return { text, removed: 0 };
  const all = sentences(text);
  let removed = 0;
  const kept = all.filter((s) => {
    const ok = sentenceSupported(s, src, checkNames);
    if (!ok) removed++;
    return ok;
  });
  return { text: kept.join(" ").trim(), removed };
}

/**
 * An English and a Welsh text checked together. When both have the same
 * number of sentences, sentence n of one is taken to be sentence n of the
 * other, and a sentence that fails in either language is removed from both,
 * so neither language says something the other doesn't. When the counts
 * differ the sentences can't be paired, so each language is checked on its
 * own and `paired` is false.
 */
export function groundedPair(
  en: string,
  cy: string,
  src: Source,
): { en: string; cy: string; removed: number; paired: boolean } {
  const e = sentences(en);
  const c = sentences(cy);
  if (e.length === c.length) {
    const keep = e.map((s, i) => sentenceSupported(s, src, true) && sentenceSupported(c[i], src, false));
    const removed = keep.filter((k) => !k).length;
    return {
      en: e.filter((_, i) => keep[i]).join(" "),
      cy: c.filter((_, i) => keep[i]).join(" "),
      removed,
      paired: true,
    };
  }
  const ge = grounded(en, src, true);
  const gc = grounded(cy, src, false);
  return { en: ge.text, cy: gc.text, removed: ge.removed + gc.removed, paired: false };
}

/**
 * Makes sure an overview's first sentence stands on its own. When the check
 * removed the opening sentence in either language, what is left can start
 * mid-thought ("It granted one driver's application…"). The opening then goes
 * from both languages, so they stay in step, and the same plain opening takes
 * its place in each ("The Public Protection Sub Committee met in October
 * 2026."). Nothing changes when both openings were kept, or when nothing else
 * is left.
 */
export function withStandAloneOpening(
  original: { en: string; cy: string },
  kept: { en: string; cy: string },
  opening: { en: string; cy: string },
): { en: string; cy: string; replaced: boolean } {
  const oe = sentences(original.en);
  const oc = sentences(original.cy);
  const ke = sentences(kept.en);
  const kc = sentences(kept.cy);
  const lostEn = oe.length > 0 && ke[0] !== oe[0];
  const lostCy = oc.length > 0 && kc[0] !== oc[0];
  if (!lostEn && !lostCy) return { ...kept, replaced: false };
  // Where only one language lost its opening, the other's first sentence said the same thing: it goes too.
  const restEn = lostEn ? ke : ke.slice(1);
  const restCy = lostCy ? kc : kc.slice(1);
  if (!restEn.length && !restCy.length) return { ...kept, replaced: false };
  return { en: [opening.en, ...restEn].join(" "), cy: [opening.cy, ...restCy].join(" "), replaced: true };
}
