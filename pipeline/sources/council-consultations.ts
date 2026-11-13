/**
 * Readers for the councils whose consultation pages list each consultation
 * with its dates (data/curated/consultation-pages.ts). Others are linked to,
 * not read. Fixtures: pipeline/fixtures/consultations/.
 */
import { parse, type HTMLElement } from "node-html-parser";
import { longDate } from "./govwales";

export interface CouncilConsultation {
  url: string;
  title: string;
  summary: string | null;
  opens: string | null;
  closes: string | null;
}

const clean = (s: string | undefined | null) =>
  (s ?? "")
    .replace(/&nbsp;| /g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "24/11/2026" as "2026-11-24". */
export function ukDate(s: string | undefined | null): string | null {
  const m = clean(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

const abs = (href: string, base: string) => new URL(href.replace(/&amp;/g, "&"), base).toString();

function text(el: HTMLElement | null | undefined): string {
  return clean(el?.text);
}

/** Pembrokeshire: a table of Consultation, Start Date, End Date. */
function pembrokeshire(html: string, base: string): CouncilConsultation[] {
  const out: CouncilConsultation[] = [];
  for (const tr of parse(html).querySelectorAll("table tr")) {
    const tds = tr.querySelectorAll("td");
    const a = tds[0]?.querySelector("a");
    const href = a?.getAttribute("href");
    if (tds.length < 3 || !href) continue;
    out.push({ url: abs(href, base), title: text(a), summary: null, opens: ukDate(tds[1].text), closes: ukDate(tds[2].text) });
  }
  return out;
}

/** Rhondda Cynon Taf: a table of Title, Topic (a description) and End date ("31st October 2026"). */
function rhonddaCynonTaf(html: string, base: string): CouncilConsultation[] {
  const out: CouncilConsultation[] = [];
  for (const tr of parse(html).querySelectorAll("table tr")) {
    const tds = tr.querySelectorAll("td");
    const a = tds[0]?.querySelector("a");
    const href = a?.getAttribute("href");
    if (tds.length < 3 || !href) continue;
    out.push({
      url: abs(href, base),
      title: text(a),
      summary: text(tds[1]) || null,
      opens: null,
      closes: longDate(text(tds[2]).replace(/(\d)(st|nd|rd|th)\b/gi, "$1")),
    });
  }
  return out;
}

/** Flintshire: a list of items, each with "Opened" and "Closes" badges. */
function flintshire(html: string, base: string): CouncilConsultation[] {
  const out: CouncilConsultation[] = [];
  for (const li of parse(html).querySelectorAll("li.consultation-item")) {
    const a = li.querySelector("a");
    const href = a?.getAttribute("href");
    if (!href) continue;
    const t = text(li);
    out.push({
      url: abs(href, base),
      title: text(a),
      summary: null,
      opens: ukDate(t.match(/Opened:\s*([\d/]+)/)?.[1]),
      closes: ukDate(t.match(/Closes:\s*([\d/]+)/)?.[1]),
    });
  }
  return out;
}

export const COUNCIL_READERS: Record<string, (html: string, base: string) => CouncilConsultation[]> = {
  pembrokeshire,
  "rhondda-cynon-taf": rhonddaCynonTaf,
  flintshire,
};
