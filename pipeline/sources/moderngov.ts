/**
 * Parsers for a council's ModernGov web service
 * (https://<council>.moderngov.co.uk/mgWebService.asmx), the official source
 * for councillors, wards, committees, committee membership, meetings, agenda
 * items, agenda documents, minutes and attendance.
 *
 * Copied from OpenSenedd's pipeline/sources/moderngov.ts (the Senedd runs the
 * same software) and adapted for councils. The two codebases are separate:
 * change this file here, never there.
 *
 * Every ModernGov ID (councillor UID, committee, meeting, agenda item,
 * attachment) is unique only within one council's site.
 */
import { XMLParser } from "fast-xml-parser";
import { parse } from "node-html-parser";
import type { AttendanceStatus, CommitteeKind } from "../../src/db/schema";
import { decodeEntities, htmlToText, slugify } from "../lib/text";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  parseTagValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: false,
});

const arr = <T>(v: T | T[] | undefined | null): T[] =>
  Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v];
const str = (v: unknown): string =>
  typeof v === "string" ? decodeEntities(v).trim() : typeof v === "number" ? String(v) : "";
const int = (v: unknown): number | null => {
  const n = Number.parseInt(str(v), 10);
  return Number.isFinite(n) ? n : null;
};
const bool = (v: unknown): boolean => str(v) === "True";

/** "08/05/2026" → "2026-05-08" */
export function ukDate(v: unknown): string | null {
  const m = str(v).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export function isoToUk(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** "10.00" → "10:00" */
function time(v: unknown): string | null {
  const t = str(v).replace(".", ":");
  return /^\d{1,2}:\d{2}$/.test(t) ? t.padStart(5, "0") : null;
}

/**
 * Maps a council's party label to a party ID used for colours and names.
 * Local groups and anything unrecognised return null and keep their own label.
 */
export function partyIdFor(label: string | null | undefined): string | null {
  const t = (label ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!t) return null;
  // "Plaid Werdd" is the Green Party in Welsh: test for the Greens first. Joint Plaid and Green groups keep their own label.
  const green = /green|werdd|gwyrdd/.test(t);
  if (green && t.includes("plaid cymru")) return null;
  if (green) return "green";
  if (t.includes("plaid")) return "pc";
  if (t.includes("reform")) return "reform";
  if (t.includes("conservative")) return "con";
  if (t.includes("labour")) return "lab";
  if (t.includes("green")) return "green";
  if (t.includes("liberal democrat") || t === "lib dem" || t === "libdem") return "ld";
  if (t === "independent" || t === "ind" || t.startsWith("independent ")) return "ind";
  return null;
}

/* -------------------------------------------------------------------------- */
/* Councillors and wards                                                       */
/* -------------------------------------------------------------------------- */

export interface CouncillorRow {
  id: number;
  name: string;
  honorific: string | null;
  ward: string;
  wardSlug: string;
  partyLabel: string;
  partyId: string | null;
  groupLabel: string;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  keyPosts: string[];
  termStart: string | null;
}

/** "Councillor Dr Jane Jones" → { name: "Jane Jones", honorific: "Dr" } */
export function splitHonorific(full: string): { name: string; honorific: string | null } {
  let s = full
    .replace(/\s+(MS|AS|MP|AC|AM)$/u, "")
    .replace(/^(Councillor|Cllr\.?|Cynghorydd|Y Cynghorydd|Cyng\.?)\s+/i, "")
    .trim();
  const m = s.match(/^((?:The\s+)?(?:Rt\.?\s*)?Hon\.?|Dr\.?|Prof\.?|Professor|Mr\.?|Mrs\.?|Ms\.?|Miss)\s+/i);
  let honorific: string | null = null;
  if (m) {
    honorific = m[1].trim();
    s = s.slice(m[0].length).trim();
  }
  // Titles such as "Mr" and "Mrs" aren't shown; academic and parliamentary ones are.
  if (honorific && /^(mr|mrs|ms|miss)\.?$/i.test(honorific)) honorific = null;
  return { name: s, honorific };
}

export function parseCouncillorsByWard(xml: string): CouncillorRow[] {
  const doc = parser.parse(xml);
  const out: CouncillorRow[] = [];
  for (const w of arr(doc?.councillorsbyward?.wards?.ward)) {
    const ward = str(w.wardtitle).replace(/\s+/g, " ");
    for (const c of arr(w?.councillors?.councillor)) {
      const id = int(c.councillorid);
      if (!id) continue;
      const { name, honorific } = splitHonorific(str(c.fullusername));
      // An empty seat is listed as a councillor named "Vacancy": it isn't one.
      if (/^vacan(cy|t)\b/i.test(name)) continue;
      const starts = arr(c?.termsofoffice?.termofoffice)
        .map((t: Record<string, unknown>) => ukDate(t.startdate))
        .filter(Boolean) as string[];
      out.push({
        id,
        name,
        honorific,
        ward,
        wardSlug: slugify(ward),
        partyLabel: str(c.politicalpartytitle),
        partyId: partyIdFor(str(c.politicalpartytitle)),
        groupLabel: str(c.politicalgrouptitle),
        photoUrl: str(c.photobigurl) || null,
        email: str(c?.workaddress?.email) || null,
        phone: str(c?.workaddress?.phone) || null,
        keyPosts: str(c.keyposts)
          .split(/\s*[;\n]\s*/)
          .map((s) => s.trim())
          .filter(Boolean),
        termStart: starts.sort().at(-1) ?? null,
      });
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* Committees                                                                  */
/* -------------------------------------------------------------------------- */

export interface CommitteeRow {
  id: number;
  title: string;
  expired: boolean;
  deleted: boolean;
  category: string | null;
}

export function parseCommittees(xml: string): CommitteeRow[] {
  const doc = parser.parse(xml);
  return arr(doc?.committees?.committee)
    .map((c: Record<string, unknown>) => ({
      id: int(c.committeeid) ?? 0,
      title: str(c.committeetitle).replace(/\s+/g, " "),
      expired: bool(c.committeeexpired),
      deleted: bool(c.committeedeleted),
      category: str(c.committeecategory).replace(/\s+/g, " ") || null,
    }))
    .filter((c) => c.id > 0);
}

/**
 * What kind of body a committee is, from its title. Full council, cabinet,
 * scrutiny and planning meetings get plain-language summaries.
 */
export function committeeKind(title: string): CommitteeKind {
  const t = title.toLowerCase().replace(/\s+/g, " ").trim();
  const isCommittee = /committee|panel|board|forum|group|pwyllgor|sub-|is-/.test(t);
  // Appointment panels often name the post ("Assistant Director Planning"): decide them first.
  if (/appointment|penodi/.test(t)) return "regulatory";
  // Weekly lists of applications and lists of officers' decisions are calendar entries, not meetings.
  if (/\b(weekly|lists?|delegated (decisions?|powers)|decision notices?|officer decisions?)\b/.test(t)) return "other";
  if (
    /^(ordinary |special |extraordinary |annual |budget )?(meeting of (the )?)?(full |county |city |borough )?council( meeting)?$/.test(t) ||
    (/(county|county borough|city|borough) council$/.test(t) && !isCommittee) ||
    /^(y )?cyngor( llawn| sir)?$/.test(t)
  )
    return "council";
  if (/scrutiny|craffu/.test(t)) return "scrutiny";
  if (/\bcabinet\b|^(the )?executive( board)?$|^bwrdd gweithredol|pwyllgor gwaith/.test(t)) return "cabinet";
  if (/planning|cynllunio/.test(t)) return "planning";
  if (/licensing|audit|governance|standards|appeals|appointments|regulatory|democratic services|democracy services|pension|trwyddedu|archwilio|safonau|llywodraethu/.test(t))
    return "regulatory";
  return "other";
}

export const SUMMARISED_KINDS: ReadonlySet<CommitteeKind> = new Set(["council", "cabinet", "scrutiny", "planning"]);

export interface UserCommittee {
  committeeId: number;
  title: string;
  expired: boolean;
  role: string;
}

export function parseCommitteesByUser(xml: string): UserCommittee[] {
  const doc = parser.parse(xml);
  return arr(doc?.committees?.committee)
    .map((c: Record<string, unknown>) => ({
      committeeId: int(c.committeeid) ?? 0,
      title: str(c.committeetitle),
      expired: bool(c.committeeexpired),
      role: str(c.userrole) || "Member",
    }))
    .filter((c) => c.committeeId > 0);
}

/** A councillor's place on a committee, from the role ModernGov gives. */
export function committeeRole(userRole: string): "chair" | "vice-chair" | "member" | "substitute" | "observer" {
  const t = userRole.toLowerCase().replace(/\s+/g, " ").trim();
  // Observers, co-opted and advisory members aren't full voting members of the committee.
  if (/observer|co-?opted|advis|in attendance|sylwedydd|cyfetholedig/.test(t)) return "observer";
  if (/^(vice|deputy)[ -]?chair/.test(t)) return "vice-chair";
  if (/^(non-active )?chair(man|person|woman)?$/.test(t)) return "chair";
  if (/\bsubstitute\b|\breserve\b/.test(t)) return "substitute";
  return "member";
}

/** Welsh committee names, from the council's committee list page in Welsh. */
export function parseWelshCommitteeNames(html: string): Array<{ id: number; nameCy: string }> {
  const root = parse(html);
  const out = new Map<number, string>();
  for (const a of root.querySelectorAll("a")) {
    const m = (a.getAttribute("href") ?? "").match(/(?:mgCommitteeDetails\.aspx\?ID|ieListMeetings\.aspx\?CId)=(\d+)/i);
    if (!m) continue;
    const name = decodeEntities(a.text).replace(/\s+/g, " ").trim();
    if (name) out.set(Number(m[1]), name);
  }
  return [...out.entries()].map(([id, nameCy]) => ({ id, nameCy }));
}

/* -------------------------------------------------------------------------- */
/* Meetings                                                                    */
/* -------------------------------------------------------------------------- */

export interface MeetingSummary {
  meetingId: number;
  committeeId: number;
  committeeTitle: string;
  date: string;
  time: string | null;
  status: string;
}

export function parseMeetings(xml: string): MeetingSummary[] {
  const doc = parser.parse(xml);
  const out: MeetingSummary[] = [];
  for (const c of arr(doc?.getmeetings?.committee)) {
    const committeeId = int(c.committeeid) ?? 0;
    const committeeTitle = str(c.committeetitle);
    for (const m of arr(c?.committeemeetings?.meeting)) {
      const date = ukDate(m.meetingdate);
      const meetingId = int(m.meetingid);
      if (!date || !meetingId) continue;
      out.push({ meetingId, committeeId, committeeTitle, date, time: time(m.meetingtime), status: str(m.meetingstatus) });
    }
  }
  return out;
}

export interface MeetingDocument {
  id: number;
  title: string;
  url: string;
  published: string | null;
  isDecisionAttachment: boolean;
}

export interface MeetingItem {
  id: number;
  seq: number;
  number: string;
  title: string;
  isDecision: boolean;
  isRestricted: boolean;
  declarationCount: number;
  agendaText: string | null;
  minutes: string | null;
  documents: MeetingDocument[];
}

export interface MeetingAttendee {
  councillorId: number;
  name: string;
  role: string;
  attendance: string;
}

export interface MeetingDetail {
  meetingId: number;
  date: string | null;
  time: string | null;
  status: string;
  location: string | null;
  agendaPublished: boolean;
  minutesPublished: boolean;
  decisionsPublished: boolean;
  items: MeetingItem[];
  attendees: MeetingAttendee[];
}

function docs(a: Record<string, unknown>): MeetingDocument[] {
  const linked = (a?.linkeddocuments as Record<string, unknown> | undefined)?.linkeddoc;
  return arr(linked as Record<string, unknown> | Record<string, unknown>[])
    .filter((d) => !bool(d.isrestricted) && !bool(d.isurl))
    .map((d) => ({
      id: int(d.attachmentid) ?? 0,
      title: str(d.title).replace(/\s+/g, " "),
      url: str(d.url),
      published: ukDate(d.publicationdate),
      isDecisionAttachment: bool(d.isdecisionattachment),
    }))
    .filter((d) => d.id > 0 && d.url.startsWith("http"));
}

export function parseMeeting(xml: string): MeetingDetail | null {
  const doc = parser.parse(xml);
  const m = doc?.meeting;
  if (!m) return null;
  const meetingId = int(m.meetingid);
  if (!meetingId) return null;
  const items: MeetingItem[] = arr(m?.agendaitems?.agendaitem)
    .map((a: Record<string, unknown>, i: number) => {
      // Line breaks in ModernGov's HTML source are not meaningful; <br> and <p> are.
      const minuteHtml = str(a.minutesnonemptyhtmlbody).replace(/\r?\n/g, " ");
      const agendaHtml = str(a.agendatext).replace(/\r?\n/g, " ");
      // ModernGov puts the minute in the item text once minutes are published.
      // When there is no minute, the item text is used only if it records a resolution: otherwise it is the
      // agenda's own wording ("To consider and approve..."), which isn't what happened.
      const agendaAsMinute = bool(a.isminutepublished) ? htmlToText(agendaHtml) : "";
      const minutes = htmlToText(minuteHtml) || (resolvedText(agendaAsMinute) ? agendaAsMinute : "");
      const number = [str(a.agendaitemnumber), str(a.agendaitemsubnumber).replace(/[()\s]/g, "")]
        .filter((x) => x && x !== "0")
        .join(".");
      return {
        id: int(a.agendaitemid) ?? 0,
        seq: i + 1,
        number,
        title: str(a.agendaitemtitle).replace(/\s+/g, " "),
        isDecision: bool(a.isdecision),
        isRestricted: bool(a.isrestricted),
        declarationCount: int(a.declarationcount) ?? 0,
        agendaText: bool(a.isminutepublished) && !minuteHtml ? null : htmlToText(agendaHtml) || null,
        minutes: minutes || null,
        documents: docs(a),
      };
    })
    .filter((a) => a.id > 0 && a.title);
  const attendees = arr(m?.attendees?.attendee)
    .map((a: Record<string, unknown>) => ({
      councillorId: int(a["@memberid"]) ?? 0,
      name: splitHonorific(str(a["@name"])).name,
      role: str(a["@roledescription"]),
      attendance: str(a["@attendance"]),
    }))
    .filter((a) => a.councillorId > 0);
  return {
    meetingId,
    date: ukDate(m.meetingdate),
    time: time(m.meetingactualstarttime) ?? time(m.meetingtime),
    status: str(m.meetingstatus),
    location: str(m.meetinglocation) || null,
    agendaPublished: bool(m.agendapublished),
    minutesPublished: bool(m.minutepublished),
    decisionsPublished: bool(m.decisionpublished),
    items,
    attendees,
  };
}

/**
 * Normalises ModernGov attendance wording to a small, stable vocabulary.
 *
 * - "Present, as expected" (and ", virtual") → present
 * - "Present, as substitute" → substitute: attended in place of another member
 * - "Apologies" → apologies
 * - "Apologies, sent representative" → sent_substitute: gave apologies and a
 *   substitute attended instead. Counted as apologies, never as attendance.
 * - "Absent" → absent; "Expected" → expected (not recorded yet);
 *   "In attendance" → in_attendance (officers, guests, non-members)
 */
export function attendanceStatus(raw: string): AttendanceStatus | "expected" {
  const t = raw.toLowerCase().replace(/\s+/g, " ").trim();
  if (t.startsWith("present")) return /\bsubstitute\b/.test(t) ? "substitute" : "present";
  if (t.includes("apolog")) return /\b(sent|substitute|representative)\b/.test(t) ? "sent_substitute" : "apologies";
  if (t.includes("substitute")) return "substitute";
  if (t.includes("absent")) return "absent";
  if (t === "expected") return "expected";
  if (t.includes("in attendance")) return "in_attendance";
  return "other";
}

/* -------------------------------------------------------------------------- */
/* Decisions and declarations in minutes                                       */
/* -------------------------------------------------------------------------- */

/**
 * The decision part of a minute, word for word: from "RESOLVED" (or
 * "PENDERFYNWYD") to the end. Null when the minute records no resolution.
 */
export function resolvedText(minutes: string | null | undefined): string | null {
  if (!minutes) return null;
  // "RESOLVED", "Resolved that", "It was resolved", "AGREED", "Agreed:", and the Welsh forms.
  // Lower-case "agreed" in a sentence ("Members agreed to note") is not a resolution.
  const m = minutes.match(
    /(\b(RESOLVED|AGREED|PENDERFYNWYD|CYTUNWYD)\b|\b(Resolved|Agreed|Penderfynwyd|Cytunwyd)(?=\s*(that\b|:|-|–|y\b|bod\b))|\b[Ii]t was resolved\b)[\s\S]*$/,
  );
  if (!m) return null;
  const text = m[0].trim();
  return text.length >= 12 ? text : null;
}

/**
 * Routine items that don't decide anything about the area: apologies,
 * declarations of interest, approving the last meeting's minutes, the chair's
 * announcements, urgent business and excluding the public. Their "resolved"
 * text isn't counted as a decision.
 */
export function isProceduralItem(title: string): boolean {
  return /\b(apologies|ymddiheuriadau|declarations? of (personal|prejudicial )?(and prejudicial )?interests?|disclosures? of (personal|prejudicial)|datgan(iadau)? (o )?fuddiant|minutes of (the )?(previous|last)|to (approve|confirm|sign)( as a correct record)? the minutes|approval of (the )?minutes|confirmation of (the )?minutes|cofnodion|chair'?s announcements|announcements|cyhoeddiadau|urgent (items|business|matters)|exclusion of (the )?(press and )?public|gwahardd y cyhoedd|vice-?chair|is-gadeirydd|appointment of (a )?chair|ethol cadeirydd)\b/i.test(
    title,
  );
}

/** Whether an agenda item is the meeting's declarations of interest item. */
export function isDeclarationsItem(title: string): boolean {
  return /declarations? of interest|datganiadau o fuddiant|datgan buddiant/i.test(title);
}
