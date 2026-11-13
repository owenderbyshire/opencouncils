/**
 * Parsers for the few ModernGov pages that have no web service behind them:
 * a council's executive posts ("Cabinet portfolios") and its list of
 * forthcoming decisions. The web service (moderngov.ts) stays the source for
 * everything it offers.
 *
 * These are ordinary public pages, so they are read only where the council's
 * robots.txt allows (pipeline/lib/robots.ts), and a page that answers with a
 * check for automated readers is left unread.
 *
 * Fixtures: pipeline/fixtures/moderngov/ (real replies, with officers' names
 * and contact details taken out).
 */
import { parse, type HTMLElement } from "node-html-parser";
import { decodeEntities, htmlToText } from "../lib/text";
import { ukDate } from "./moderngov";

const text = (s: string | undefined | null) => decodeEntities(s ?? "").replace(/[\s ]+/g, " ").trim();

/** Whether a reply is a ModernGov page at all, and not an error page or a check put in front of it. */
export function isModernGovPage(html: string): boolean {
  return /id=["']?modgov|class=["']?mgContent|class=["']?mgHeader|modern\.gov/i.test(html);
}

/* -------------------------------------------------------------------------- */
/* Executive posts                                                             */
/* -------------------------------------------------------------------------- */

export const execPostsUrl = (base: string) => `${base}/mgListExecPosts.aspx?bcr=1`;
export const execPostUrl = (base: string, id: number) => `${base}/mgExecPostDetails.aspx?ID=${id}`;

export interface ExecPostLink {
  id: number;
  title: string;
}

/** The posts a council lists on its executive posts page. */
export function parseExecPostList(html: string): ExecPostLink[] {
  const out = new Map<number, string>();
  for (const a of parse(html).querySelectorAll("a")) {
    const m = (a.getAttribute("href") ?? "").match(/mgExecPostDetails\.aspx\?ID=(\d+)/i);
    const title = text(a.text);
    if (m && title && !out.has(Number(m[1]))) out.set(Number(m[1]), title);
  }
  return [...out].map(([id, title]) => ({ id, title }));
}

export interface ExecPost {
  title: string;
  /** Councillors the page says hold the post. Empty when it is vacant. */
  holders: Array<{ councillorId: number; name: string }>;
}

/** One executive post's page: its name and who holds it. Null when the page is not one. */
export function parseExecPost(html: string): ExecPost | null {
  const root = parse(html);
  const heading = root.querySelector("h2.mgSubTitleTxt");
  const title = text(heading?.text);
  if (!heading || !title) return null;
  const holders = new Map<number, string>();
  // "Post is held by" is a bulleted list of links to councillors, after the post's name. A vacant post has none.
  for (const list of root.querySelectorAll("ul.mgBulletList")) {
    for (const a of list.querySelectorAll("a")) {
      const m = (a.getAttribute("href") ?? "").match(/mgUserInfo\.aspx\?UID=(\d+)/i);
      const name = text(a.text);
      if (m && name) holders.set(Number(m[1]), name);
    }
  }
  return { title, holders: [...holders].map(([councillorId, name]) => ({ councillorId, name })) };
}

/* -------------------------------------------------------------------------- */
/* Forthcoming decisions                                                       */
/* -------------------------------------------------------------------------- */

const FORTHCOMING = "RP=0&DM=0&HD=0&DS=1&Next=true&H=0&META=mgforthcomingdecisions";

/** The council's list of forthcoming decisions, one block each ("Details"), as its own menu links to it. */
export const forthcomingUrl = (base: string) => `${base}/mgDelegatedDecisions.aspx?${FORTHCOMING}&K=0&V=1&bcr=1`;
/** The same list with the council's own "key decisions only" filter, as a table. */
export const forthcomingKeyUrl = (base: string) => `${base}/mgDelegatedDecisions.aspx?${FORTHCOMING}&K=1&V=0&bcr=1`;
export const issueUrl = (base: string, issueId: number) => `${base}/mgIssueHistoryHome.aspx?IId=${issueId}&Opt=0`;

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export interface DueDate {
  /** The day, or the first of the month when only a month is given. */
  date: string;
  monthOnly: boolean;
}

/**
 * When a decision is due, as ModernGov writes it: "28/01/2027", "17 Dec 2026",
 * "01/2027", "June 2027". Null for anything else, so a date is never guessed.
 */
export function parseDue(raw: string): DueDate | null {
  const t = text(raw);
  const day = ukDate(t);
  if (day && /^\d{2}\/\d{2}\/\d{4}$/.test(t)) return valid(day, false);
  let m = t.match(/^(\d{1,2}) ([A-Za-z]{3,9}),? (\d{4})$/);
  if (m) {
    const i = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    return i < 0 ? null : valid(`${m[3]}-${String(i + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`, false);
  }
  m = t.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return valid(`${m[2]}-${m[1].padStart(2, "0")}-01`, true);
  m = t.match(/^([A-Za-z]{3,9}) (\d{4})$/);
  if (m) {
    const i = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    return i < 0 ? null : valid(`${m[2]}-${String(i + 1).padStart(2, "0")}-01`, true);
  }
  return null;
}

function valid(iso: string, monthOnly: boolean): DueDate | null {
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? { date: iso, monthOnly } : null;
}

/** The labelled lines ModernGov prints under a decision: "Decision Maker: Cabinet". Labels are lower-cased, without the colon. */
function fields(block: HTMLElement): Array<[label: string, value: string, el: HTMLElement]> {
  const out: Array<[string, string, HTMLElement]> = [];
  for (const span of block.querySelectorAll("span.mgLabel")) {
    const p = span.parentNode as HTMLElement | null;
    if (!p) continue;
    const label = text(span.text).replace(/:$/, "").trim().toLowerCase();
    // The value is the rest of the line, without the label and without links such as "view reasons".
    const copy = parse(p.innerHTML);
    copy.querySelectorAll("span.mgLabel, a").forEach((x) => x.remove());
    out.push([label, text(copy.text).replace(/\s*-\s*$/, "").trim(), p]);
  }
  return out;
}

export interface ForthcomingDecision {
  issueId: number;
  title: string;
  purpose: string | null;
  /** Who decides, as published: one body or several. */
  makers: string;
  due: DueDate | null;
  /** The due date as published, when it could not be read as a date. */
  dueUnread: string | null;
  noticePublished: string | null;
  restriction: string | null;
}

export interface ForthcomingList {
  /** False when the page is not the decisions list at all (an error page, a check): nothing can be concluded from it. */
  recognised: boolean;
  decisions: ForthcomingDecision[];
}

/** The council's forthcoming decisions, from the "Details" view of its decisions list. */
export function parseForthcoming(html: string): ForthcomingList {
  const root = parse(html);
  // The search form is on the page whether or not anything is listed: it is what shows this is the decisions list.
  const recognised = Boolean(root.querySelector("#KeyDec") || root.querySelector("input[name=KeyDec]")) && isModernGovPage(html);
  const decisions = new Map<number, ForthcomingDecision>();
  for (const block of root.querySelectorAll("div.mgDetailsBlock")) {
    const link = block.querySelectorAll("a").find((a) => /mgIssueHistoryHome\.aspx\?IId=\d+/i.test(a.getAttribute("href") ?? ""));
    const issueId = Number((link?.getAttribute("href") ?? "").match(/IId=(\d+)/i)?.[1]);
    // The heading is "06/11/2026 - Title": the date is when the entry last changed, not when the decision is due.
    const title = text(block.querySelector("h3")?.text).replace(/^\d{2}\/\d{2}\/\d{4}\s+-\s+/, "");
    if (!issueId || !title) continue;
    const f = fields(block);
    const get = (...labels: string[]) => f.find(([l]) => labels.includes(l))?.[1] || null;
    const dueRaw = get("decision due date", "decision due");
    const due = dueRaw ? parseDue(dueRaw) : null;
    const purpose = htmlToText(block.querySelector("div.mgWordPara")?.innerHTML ?? "").replace(/\s*\n\s*/g, " ").trim();
    decisions.set(issueId, {
      issueId,
      title,
      purpose: purpose || null,
      makers: get("decision maker", "decision makers") ?? "",
      due,
      dueUnread: dueRaw && !due ? dueRaw : null,
      noticePublished: ukDate(get("notice of decision", "notice of proposed decision first published") ?? ""),
      restriction: get("anticipated restriction"),
    });
  }
  return { recognised, decisions: [...decisions.values()] };
}

/** The matters on a decisions table ("Summary" view): used with the key decisions filter to learn which are key. */
export function parseDecisionTableIds(html: string): { recognised: boolean; issueIds: number[] } {
  const root = parse(html);
  const recognised = Boolean(root.querySelector("#KeyDec") || root.querySelector("input[name=KeyDec]")) && isModernGovPage(html);
  const ids = new Set<number>();
  for (const a of root.querySelectorAll("table.mgTabTable a")) {
    const m = (a.getAttribute("href") ?? "").match(/mgIssueHistoryHome\.aspx\?IId=(\d+)/i);
    if (m) ids.add(Number(m[1]));
  }
  return { recognised, issueIds: [...ids] };
}

export interface IssueStage {
  maker: string;
  due: DueDate | null;
}

export interface IssuePage {
  title: string;
  /** "Key", "Non-key" or the council's own word for it. */
  decisionType: string | null;
  status: string | null;
  /** One line for each body the matter goes to: "15 Dec 2026 by Cabinet". */
  stages: IssueStage[];
  /** The lead member's post, as the council names it. */
  leadMember: string | null;
  /** The lead director's post, kept only when it reads as a post. Never a person's name: the "Contact" line is not read. */
  leadDirector: string | null;
  /** Agenda items the council links from the matter: where it has been, or is, on an agenda. */
  agendaItems: Array<{ agendaItemId: number; date: string | null; committee: string }>;
}

const RANK = /^(?:the\s+)?(?:(?:deputy|assistant|interim|acting|corporate|strategic|executive|group|service|joint|statutory|principal|senior)\s+)*(?:director|head|chief|manager|monitoring officer|section 151 officer|solicitor|treasurer)\b/i;

/**
 * An officer's post, kept only when the text opens with a rank ("Director of
 * Place", "Head of Service - Adult Services"). Anything else could be a
 * person's name, and officers' names are not held.
 */
export function officerPost(value: string | null | undefined): string | null {
  const t = text(value);
  return t && RANK.test(t) && !/[@\d]/.test(t) ? t : null;
}

/** A council's own page for one matter ("issue"). Null when the page is not one. */
export function parseIssue(html: string): IssuePage | null {
  const root = parse(html);
  const title = text(root.querySelector("h2.mgSubTitleTxt")?.text);
  const group = root.querySelector("div.mgFieldGroup");
  if (!title || !group) return null;
  const f = fields(group);
  const get = (label: string) => f.find(([l]) => l === label)?.[1] || null;
  const stages: IssueStage[] = [];
  for (const [label, value] of f) {
    if (label !== "decision due") continue;
    // "17 Dec 2026 by Cabinet", "June 2027 by Council"
    const m = value.match(/^(.*?)\s+by\s+(.+)$/i);
    if (m) stages.push({ maker: m[2].trim(), due: parseDue(m[1]) });
  }
  const agendaItems: IssuePage["agendaItems"] = [];
  for (const li of root.querySelectorAll("ul.mgBulletList li")) {
    const a = li.querySelectorAll("a").find((x) => /#AI\d+/.test(x.getAttribute("href") ?? ""));
    const id = Number((a?.getAttribute("href") ?? "").match(/#AI(\d+)/)?.[1]);
    if (!a || !id) continue;
    const date = ukDate(text(li.querySelector("span.mgDateTxt")?.text));
    // "23/02/2012 - Council <link>": the body's name sits between the date and the link.
    const copy = parse(li.innerHTML);
    copy.querySelectorAll("a, span.mgDateTxt").forEach((x) => x.remove());
    agendaItems.push({ agendaItemId: id, date, committee: text(copy.text).replace(/^[-–\s]+/, "").trim() });
  }
  return {
    title,
    decisionType: get("decision type"),
    status: get("decision status"),
    stages,
    leadMember: get("lead member"),
    leadDirector: officerPost(get("lead director")),
    agendaItems,
  };
}

/**
 * Whether a council's word for the decision type means a key decision. Null
 * when it says neither, so "key" is never assumed.
 */
export function isKeyType(decisionType: string | null | undefined): boolean | null {
  const t = text(decisionType).toLowerCase();
  if (!t) return null;
  if (/^non[- ]?key\b|^not key\b|ddim yn allweddol|heb fod yn allweddol|anallweddol/.test(t)) return false;
  if (/^key\b|^allweddol\b/.test(t)) return true;
  return null;
}
