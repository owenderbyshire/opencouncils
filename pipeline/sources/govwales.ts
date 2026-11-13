/**
 * gov.wales / llyw.cymru: the Welsh Government's list of open consultations
 * and each consultation's own page. Copied from OpenSenedd.
 */
import { parse, type HTMLElement } from "node-html-parser";

export const GOV_BASE = "https://www.gov.wales";
/** Open consultations and calls for evidence, newest first. */
export const OPEN_CONSULTATIONS_URL = `${GOV_BASE}/consultations?field_consultation_status=1`;

const clean = (s: string | undefined | null) =>
  (s ?? "").replace(/\s+/g, " ").trim();

const abs = (href: string) => new URL(href, GOV_BASE).toString();

/** The page's Welsh (or English) twin, from its hreflang link. */
export function alternateUrl(html: string, lang: "cy" | "en"): string | null {
  const m =
    html.match(
      new RegExp(`<link[^>]*hreflang="${lang}"[^>]*href="([^"]+)"`, "i"),
    ) ??
    html.match(
      new RegExp(`<link[^>]*href="([^"]+)"[^>]*hreflang="${lang}"`, "i"),
    );
  return m ? m[1].replace(/&amp;/g, "&") : null;
}

function title(root: HTMLElement): string {
  return clean(root.querySelector("h1")?.text);
}



export interface ListedConsultation {
  url: string;
  title: string;
  /** "Open consultation", "Open call for evidence". */
  type: string;
  area: string | null;
  published: string | null;
}

export function parseConsultationList(html: string): {
  items: ListedConsultation[];
  total: number | null;
  hasNext: boolean;
} {
  const root = parse(html);
  const items: ListedConsultation[] = [];
  for (const li of root.querySelectorAll(".index-list__items > li")) {
    const a = li.querySelector(".index-list__title a");
    const href = a?.getAttribute("href");
    if (!href) continue;
    const time = li.querySelector(".index-list__date time")?.getAttribute("datetime");
    items.push({
      url: abs(href),
      title: clean(a?.text),
      type: clean(li.querySelector(".index-list__type")?.text),
      area: clean(li.querySelector(".index-list__topics")?.text) || null,
      published: time ? time.slice(0, 10) : null,
    });
  }
  const total = Number(clean(root.querySelector(".index-list__count")?.text));
  const hasNext = Boolean(
    root.querySelector('.pager__item--next a, a[rel="next"], li.next a'),
  );
  return { items, total: Number.isFinite(total) ? total : null, hasNext };
}

const MONTHS_EN = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTHS_CY = ["ionawr", "chwefror", "mawrth", "ebrill", "mai", "mehefin", "gorffennaf", "awst", "medi", "hydref", "tachwedd", "rhagfyr"];

/** "29 January 2027" or "29 Ionawr 2027" as YYYY-MM-DD. */
export function longDate(s: string): string | null {
  const m = clean(s).match(/(\d{1,2})\s+([A-Za-zâêîôûŵŷ]+)\s+(\d{4})/i);
  if (!m) return null;
  const word = m[2].toLowerCase();
  let i = MONTHS_EN.indexOf(word);
  if (i < 0) i = MONTHS_CY.findIndex((c) => c === word || word.endsWith(c.slice(1)));
  if (i < 0) return null;
  return `${m[3]}-${String(i + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export interface ConsultationPage {
  title: string;
  summary: string | null;
  opens: string | null;
  closes: string | null;
  urlCy: string | null;
}

export function parseConsultationPage(html: string): ConsultationPage {
  const root = parse(html);
  const end = root.querySelector(".header-meta .end-date .item");
  const startTime = root
    .querySelector(".header-meta .start-date time")
    ?.getAttribute("datetime");
  const summary = clean(root.querySelector(".hero-block__summary p")?.text);
  return {
    title: title(root),
    summary: summary || null,
    opens: startTime ? startTime.slice(0, 10) : null,
    closes: end ? longDate(end.text) : null,
    urlCy: alternateUrl(html, "cy"),
  };
}
