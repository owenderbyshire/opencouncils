/**
 * The Vale of Glamorgan Council doesn't use ModernGov. Its committees each
 * have a page listing meetings by municipal year, and each meeting has a page
 * with the agenda: numbered items, links to reports, and one minutes PDF.
 * Fixtures: pipeline/fixtures/vale/.
 */
import { parse } from "node-html-parser";

export const VALE_BASE = "https://www.valeofglamorgan.gov.uk";
export const VALE_AGENDAS = `${VALE_BASE}/en/our_council/Council-Structure/minutes,_agendas_and_reports`;

const clean = (s: string | undefined | null) =>
  (s ?? "")
    .replace(/&nbsp;| /g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&rsquo;/g, "’")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const abs = (href: string) => new URL(href.replace(/&amp;/g, "&"), VALE_BASE).toString();

export interface ValeCommitteeLink {
  url: string;
  /** The link's title, used until the committee's own page gives its name. */
  title: string | null;
}

/** Committee pages linked from the minutes, agendas and reports index. */
export function parseValeIndex(html: string): ValeCommitteeLink[] {
  const out = new Map<string, ValeCommitteeLink>();
  for (const a of parse(html).querySelectorAll("a")) {
    const href = a.getAttribute("href") ?? "";
    // Committee pages sit under /agendas/; meeting pages there have a year folder and are left out.
    if (!/^\/en\/our_council\/Council-Structure\/minutes,_agendas_and_reports\/agendas\/.+\.aspx$/i.test(href)) continue;
    if (/\/\d{4}\/[^/]+\.aspx$/i.test(href) || /Historic/i.test(href)) continue;
    const url = abs(href);
    if (!out.has(url)) out.set(url, { url, title: clean(a.getAttribute("title")) || null });
  }
  return [...out.values()];
}

/** A committee page's own name, from its heading. */
export function valeCommitteeName(html: string): string | null {
  return clean(parse(html).querySelector("h1")?.text) || null;
}

export interface ValeMeetingLink {
  /** The meeting page's address, which is also its identity. */
  url: string;
  date: string;
  /** "6.00pm" when a day has several meetings. */
  time: string | null;
  recording: string | null;
  decisionNotice: string | null;
}

/** Meetings linked from a committee page. Dates come from the page names, as yy-mm-dd. */
export function parseValeCommittee(html: string): ValeMeetingLink[] {
  const root = parse(html);
  const out = new Map<string, ValeMeetingLink>();
  for (const a of root.querySelectorAll("a")) {
    const href = a.getAttribute("href") ?? "";
    const m = href.match(/\/agendas\/[^"]+\/(\d{4})\/(\d{2})-(\d{2})-(\d{2})([^/]*)\.aspx$/i);
    if (!m) continue;
    const url = abs(href);
    if (out.has(url)) continue;
    const cell = a.closest("td") ?? a.parentNode;
    const links = cell?.querySelectorAll("a") ?? [];
    const time = to24(m[5]);
    out.set(url, {
      url,
      date: `20${m[2]}-${m[3]}-${m[4]}`,
      time,
      recording: links.map((l) => l.getAttribute("href") ?? "").find((h) => /youtu/.test(h)) ?? null,
      decisionNotice: (() => {
        const h = links.map((l) => l.getAttribute("href") ?? "").find((x) => /\.pdf$/i.test(x));
        return h ? abs(h) : null;
      })(),
    });
  }
  return [...out.values()].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
}

export interface ValeItem {
  /** "6", or "14" for a heading with sub-items. */
  number: string;
  title: string;
  /** Text under the heading: sub-items, a motion's wording. */
  text: string | null;
  documents: Array<{ title: string; url: string }>;
}

export interface ValeMeeting {
  committee: string | null;
  date: string | null;
  time: string | null;
  venue: string | null;
  minutes: string | null;
  urlCy: string | null;
  items: ValeItem[];
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "Monday, 5th October 2026 – 6.00pm" or "THURSDAY 24TH SEPTEMBER 2026 AT 2.00 PM" as date and time. */
export function valeDateTime(s: string): { date: string | null; time: string | null } {
  const t = clean(s);
  const m = t.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})/i);
  const i = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  const date = m && i >= 0 ? `${m[3]}-${String(i + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
  return { date, time: to24(t) };
}

/** "6.00pm" or "2.00 PM" as "18:00", the form the rest of the site uses. */
export function to24(s: string): string | null {
  const tm = s.match(/(\d{1,2})[.:](\d{2})\s*([ap])\.?\s*m\b/i);
  if (!tm) return null;
  const h = (Number(tm[1]) % 12) + (tm[3].toLowerCase() === "p" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${tm[2]}`;
}



/** One meeting's page: the details table, then numbered agenda items. */
export function parseValeMeeting(html: string): ValeMeeting {
  const root = parse(html);
  // The details come as a table on some pages and as paragraphs on others: read them from the page's text.
  const flat = clean(root.querySelector("body")?.text ?? root.text);
  const head = flat.slice(flat.search(/Notice of Meeting/i));
  const field = (re: RegExp) => clean(head.match(re)?.[1]) || null;
  const committee = field(/Notice of Meeting:?\s*(.+?)\s*Date and time/i);
  const when = valeDateTime(field(/of Meeting:?\s*(.+?)\s*Type\s*\/\s*Venue/i) ?? "");
  const venue = field(/Type\s*\/\s*Venue:?\s*(.+?)\s*(?:Agenda\b|PART I\b|1\.\s)/i)?.replace(/\.$/, "") ?? null;
  const items: ValeItem[] = [];
  let minutes: string | null = null;
  let urlCy: string | null = null;
  const main = root.querySelector("#Main-Content-Container") ?? root;
  for (const p of main.querySelectorAll("p")) {
    const text = clean(p.text);
    const links = p.querySelectorAll("a");
    for (const a of links) {
      const href = a.getAttribute("href") ?? "";
      if (!urlCy && /^\/cy\/.*\/agendas\//i.test(href)) urlCy = abs(href);
      if (!minutes && /view minute/i.test(clean(a.text)) && /\.pdf$/i.test(href)) minutes = abs(href);
    }
    const docsIn = () =>
      links
        .map((a) => ({ title: clean(a.text), url: abs(a.getAttribute("href") ?? "") }))
        .filter((d) => /\.pdf$/i.test(d.url) && !/minutes?\.pdf$/i.test(d.url) && !items.some((i) => i.documents.some((x) => x.url === d.url)));
    // Item headings start with their number: "6. Amendments to …" (sometimes split by markup, "1 4.").
    const m = text.match(/^(\d{1,2})\s?(\d)?\.\s+(.+)$/);
    const number = m ? (m[2] ? `${m[1]}${m[2]}` : m[1]) : null;
    // Numbered lists inside an item (a motion's points) restart at 1: items run in sequence.
    if (m && Number(number) === items.length + 1) {
      items.push({ number: number!, title: m[3].replace(/\s*[–-]\s*$/, ""), text: null, documents: docsIn() });
      continue;
    }
    // Anything else belongs to the item above it: sub-items and their reports.
    const current = items[items.length - 1];
    if (!current || !text || /^\[?View Minute\]?$/i.test(text) || /^PART I+\b/.test(text)) continue;
    // Section headings between items: "Reports Referred from Cabinet –".
    if (/^(Reports?|Matters?)\b.*[–-]$/i.test(text)) continue;
    current.documents.push(...docsIn());
    current.text = current.text ? `${current.text}\n${text}` : text;
  }
  return {
    committee,
    date: when.date,
    time: when.time,
    venue,
    minutes,
    urlCy,
    items,
  };
}

export interface ValeMinute {
  /** The Vale's running minute number, which continues across meetings. */
  number: string;
  title: string;
  text: string;
}

const isUpper = (s: string) => /[A-Z]/.test(s) && s === s.toUpperCase();

/**
 * The minutes PDF's text, split at each minute: a running number, then a title
 * in capitals (sometimes over two lines) ending with a dash. Page headers and
 * footers are dropped.
 */
export function splitValeMinutes(text: string): ValeMinute[] {
  const lines = text
    .replace(/\f/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => !/^\s*\d{1,4}\s*$/.test(l) && !/^\s*TRIM\b/.test(l) && !/Minutes \([A-Z]{2,5}\)\s*$/.test(l));
  const out: ValeMinute[] = [];
  let current: ValeMinute | null = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\d{2,4})\s+(\S.*)$/);
    if (m && isUpper(m[2])) {
      let title = m[2].trim();
      // A long title runs on to the next line until it reaches its closing dash.
      while (!/[–-]\s*$/.test(title) && i + 1 < lines.length && isUpper(lines[i + 1].trim()) && lines[i + 1].trim()) {
        title += ` ${lines[++i].trim()}`;
      }
      if (current) out.push(current);
      current = { number: m[1], title: clean(title.replace(/\s*[–-]\s*$/, "")), text: "" };
      continue;
    }
    if (current) current.text += `${lines[i]}\n`;
  }
  if (current) out.push(current);
  return out.map((x) => ({ ...x, text: x.text.replace(/\n{3,}/g, "\n\n").trim() }));
}

const STOP = new Set(["the", "of", "to", "and", "a", "an", "for", "in", "on", "from", "by", "with", "any", "receive", "approve", "council", "meeting", "held", "report", "reports", "ref", "mo", "hlds", "dcr"]);
const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP.has(w))
      .map((w) => w.replace(/(ies|s)$/, (x) => (x === "ies" ? "y" : ""))),
  );

/**
 * Which agenda item each minute belongs to. A minute is scored against each
 * item by how many of its title's words appear in the item's title, text or
 * reports' titles. Minutes follow the agenda's order, so the matching keeps
 * that order (several minutes may share an item) and maximises the total
 * score. A minute that matches nothing well, such as an announcement before
 * the agenda, is left out.
 */
export function matchValeMinutes(items: ValeItem[], minutes: ValeMinute[]): Map<string, string> {
  const itemWords = items.map((it) => words(`${it.title} ${it.text ?? ""} ${it.documents.map((d) => d.title).join(" ")}`));
  const scores = minutes.map((m) => {
    const want = [...words(m.title)];
    return items.map((_, i) => {
      if (!want.length) return 0;
      const s = want.filter((w) => itemWords[i].has(w)).length / want.length;
      return s >= 0.6 ? s : 0;
    });
  });
  const M = minutes.length;
  const N = items.length;
  // best[i][last + 1]: best total for minutes i.. when the previous match was item `last` (-1 for none).
  // A minute may join the previous minute's item, at a small cost, so items with sub-items can hold several.
  const SHARE = 0.25;
  const memo = new Map<number, { total: number; k: number }>();
  const solve = (i: number, last: number): { total: number; k: number } => {
    if (i === M) return { total: 0, k: -1 };
    const key = i * (N + 1) + last + 1;
    const hit = memo.get(key);
    if (hit) return hit;
    let best = { total: solve(i + 1, last).total, k: -1 };
    for (let k = Math.max(last, 0); k < N; k++) {
      const s = scores[i][k] - (k === last ? SHARE : 0);
      if (scores[i][k] <= 0 || s <= 0) continue;
      const total = s + solve(i + 1, k).total;
      if (total > best.total + 1e-9) best = { total, k };
    }
    memo.set(key, best);
    return best;
  };
  const byItem = new Map<number, ValeMinute[]>();
  let last = -1;
  for (let i = 0; i < M; i++) {
    const { k } = solve(i, last);
    if (k < 0) continue;
    byItem.set(k, [...(byItem.get(k) ?? []), minutes[i]]);
    last = k;
  }
  const out = new Map<string, string>();
  for (const [k, list] of byItem) {
    // One minute: its text. Several: each under its own title.
    out.set(items[k].number, list.length === 1 ? list[0].text : list.map((m) => `${m.title}\n${m.text}`).join("\n\n"));
  }
  return out;
}

export interface ValeCouncillor {
  url: string;
  /** "Anne Asbrey", from the council's "Asbrey, Anne". */
  name: string;
  first: string;
  surname: string;
  party: string | null;
  ward: string | null;
  photoUrl: string | null;
}

/** The councillor cards on the Vale's councillors page: name, party, ward and photo. */
export function parseValeCouncillors(html: string): ValeCouncillor[] {
  const out: ValeCouncillor[] = [];
  for (const card of parse(html).querySelectorAll(".councillor-item")) {
    const a = card.querySelector("a");
    const href = a?.getAttribute("href");
    const listed = clean(card.querySelector("h3")?.text);
    if (!href || !listed) continue;
    // Usually "Surname, First"; a few cards leave out the comma ("Brooks Bronwen").
    const [surnameRaw, firstRaw] = listed.includes(",")
      ? listed.split(",").map((x) => x.trim())
      : [listed.split(" ").slice(0, -1).join(" "), listed.split(" ").slice(-1)[0]];
    const first = firstRaw.split(" ")[0];
    const ps = card.querySelectorAll("p").map((p) => clean(p.text));
    const img = card.querySelector("img")?.getAttribute("src");
    out.push({
      url: abs(href),
      name: `${firstRaw} ${surnameRaw}`.replace(/\s+/g, " ").trim(),
      first,
      surname: surnameRaw,
      party: ps[0] || null,
      ward: ps[1] || null,
      photoUrl: img ? abs(img) : null,
    });
  }
  return out;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\b(dr|mr|mrs|ms|miss|prof)\b\.?/g, " ")
    .replace(/[^a-z' -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Names in a minutes "Present:" list, in order. */
export function valePresent(minutes: string): string[] {
  const m = minutes.match(/Present:\s*([\s\S]*?)(?:\n\s*\n|$)/);
  if (!m) return [];
  return m[1]
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bCouncillors?\b/gi, " ")
    .split(/,|\band\b/)
    .map((x) => x.replace(/\s+/g, " ").trim().replace(/\.$/, ""))
    .filter((x) => /[A-Za-z]{2}/.test(x));
}

/** Names in the minute recording apologies ("This was received from Councillor N.J. Wood."). */
export function valeApologies(minutes: ValeMinute[]): string[] {
  const m = minutes.find((x) => /^APOLOG/i.test(x.title));
  if (!m || /\bnone\b|no apologies/i.test(m.text)) return [];
  const from = m.text.match(/received from\s+([\s\S]*?)(?:\.\s*(?:\n|$)|$)/i)?.[1] ?? "";
  return from
    .replace(/\([^)]*\)/g, " ")
    .replace(/\bCouncillors?\b/gi, " ")
    .split(/,|\band\b/)
    .map((x) => x.replace(/\s+/g, " ").trim().replace(/\.$/, ""))
    .filter((x) => /[A-Za-z]{2}/.test(x));
}

/**
 * Which councillor a name in the minutes is: the full name when it matches
 * exactly, otherwise surname and first initial ("N.J. Wood"), and only when
 * that points to one councillor.
 */
export function matchValeName<T extends { name: string; first: string; surname: string }>(name: string, list: T[]): T | null {
  const n = fold(name);
  const exact = list.filter((c) => fold(c.name) === n || fold(`${c.first} ${c.surname}`) === n);
  if (exact.length === 1) return exact[0];
  const words = n.split(" ");
  const surname = words[words.length - 1];
  const initial = words[0]?.[0];
  const bySurname = list.filter((c) => fold(c.surname).split(" ").pop() === surname || fold(c.surname) === words.slice(1).join(" "));
  if (bySurname.length === 1) return bySurname[0];
  const byInitial = bySurname.filter((c) => fold(c.first)[0] === initial);
  return byInitial.length === 1 ? byInitial[0] : null;
}

export interface ValeProfile {
  email: string | null;
  phone: string | null;
  /** The "Council Roles" list, as the council words it ("Planning Committee"), with any end date it gives ("Until 13 July"). */
  roles: Array<{ name: string; until: string | null }>;
  /** The council's own attendance table for the current municipal year. */
  attendance: {
    /** "from the Annual Meeting on 13 May 2026 to the Annual Meeting on 24 May 2027" */
    period: string | null;
    rows: Array<{ name: string; url: string | null; held: number | null; attended: number | null; apologies: number | null }>;
  } | null;
}

/** A councillor's own page on the Vale's site: contact details, roles and the council's attendance record. */
export function parseValeProfile(html: string): ValeProfile {
  const root = parse(html);
  const email = root.querySelector(".sys_Contact-icons-email a[href^='mailto:']")?.getAttribute("href")?.slice(7).trim() || null;
  const phoneRaw = clean(root.querySelector(".sys_Contact-icons-telephone")?.text);
  const phone = /\d{4}/.test(phoneRaw) ? phoneRaw : null;

  const roles: ValeProfile["roles"] = [];
  const rolesHead = root.querySelectorAll("h3").find((h) => /^council roles$/i.test(clean(h.text)));
  for (let el = rolesHead?.nextElementSibling; el && el.tagName === "P"; el = el.nextElementSibling) {
    const text = clean(el.text);
    if (!text || text.startsWith("*")) continue;
    const until = text.match(/\(until\s+([^)*]+)\**\)\s*$/i)?.[1].trim() ?? null;
    roles.push({ name: text.replace(/\s*\(until[^)]*\)\s*$/i, "").trim(), until });
  }

  let attendance: ValeProfile["attendance"] = null;
  const attHead = root.querySelectorAll("h3").find((h) => /^attendance at meetings$/i.test(clean(h.text)));
  const table = attHead?.parentNode?.querySelector("table");
  if (attHead && table) {
    const periodP = attHead.nextElementSibling;
    const period = periodP && /^\(.*\)$/.test(clean(periodP.text)) ? clean(periodP.text).slice(1, -1).trim() : null;
    const num = (s: string | undefined) => {
      const t = clean(s);
      return /^\d+$/.test(t) ? Number(t) : null;
    };
    const rows = table
      .querySelectorAll("tr")
      .map((tr) => tr.querySelectorAll("td"))
      .filter((tds) => tds.length >= 5)
      .map((tds) => {
        const a = tds[0].querySelector("a");
        return {
          name: clean(tds[0].text),
          url: a?.getAttribute("href") ? abs(a.getAttribute("href")!) : null,
          held: num(tds[1].text),
          attended: num(tds[2].text),
          apologies: num(tds[4].text),
        };
      })
      .filter((r) => r.name);
    attendance = { period, rows };
  }
  return { email, phone, roles, attendance };
}

/** A committee name reduced to its words, so "Scrutiny (Place)" and "Place Scrutiny Committee" match. */
export function valeCommitteeKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !["committee", "the", "of", "and", "including", "annual", "meeting"].includes(w))
    .sort()
    .join(" ");
}
