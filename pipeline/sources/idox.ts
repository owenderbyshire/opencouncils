/**
 * Idox Public Access planning registers (".../online-applications/"), read
 * directly for authorities UK PlanIt doesn't cover. Each week's list of newly
 * validated applications gives their keys; each application's summary, dates
 * and further-information pages give the rest. Fixtures:
 * pipeline/fixtures/idox/ (Monmouthshire).
 */
import { parse } from "node-html-parser";

export interface IdoxListItem {
  keyVal: string;
  reference: string;
  description: string | null;
  address: string | null;
  received: string | null;
  validated: string | null;
  status: string | null;
}

const clean = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "Wed 21 Oct 2026" or "21 Oct 2026" to "2026-10-21"; "Not Available" to null. */
export function idoxDate(s: string | null | undefined): string | null {
  const m = clean(s).match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].toLowerCase());
  if (month < 0) return null;
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

/** The applications on a weekly list results page. */
export function parseIdoxResults(html: string): { items: IdoxListItem[]; total: number | null } {
  const root = parse(html);
  const items: IdoxListItem[] = [];
  for (const li of root.querySelectorAll("li.searchresult")) {
    const href = li.querySelector("a")?.getAttribute("href") ?? "";
    const keyVal = href.match(/keyVal=([A-Z0-9]+)/i)?.[1];
    // Older skins separate the fields with "|", newer ones with a middle dot.
    const meta = clean(li.querySelector(".metaInfo")?.text).replace(/\s*(?:&middot;|·)\s*/g, " | ");
    const reference = meta.match(/Ref\. No:\s*(.+?)\s*\|/)?.[1] ?? null;
    if (!keyVal || !reference) continue;
    items.push({
      keyVal,
      reference,
      description: clean(li.querySelector(".summaryLinkTextClamp")?.text ?? li.querySelector("a")?.text) || null,
      address: clean(li.querySelector(".address")?.text) || null,
      received: idoxDate(meta.match(/Received:\s*([^|]+)/)?.[1]),
      validated: idoxDate(meta.match(/Validated:\s*([^|]+)/)?.[1]),
      status: clean(meta.match(/Status:\s*([^|]+)$/)?.[1]) || clean(li.querySelector(".badge-status .value")?.text) || null,
    });
  }
  const total = clean(root.querySelector(".showing")?.text).match(/of\s+(\d+)/)?.[1];
  return { items, total: total ? Number(total) : null };
}

/** A details table (summary, dates, further information) as label to value. */
export function parseIdoxTable(html: string): Record<string, string> {
  const root = parse(html);
  const table = root.querySelector("#simpleDetailsTable") ?? root.querySelector("#applicationDetails");
  const out: Record<string, string> = {};
  for (const tr of table?.querySelectorAll("tr") ?? []) {
    const k = clean(tr.querySelector("th")?.text);
    const v = clean(tr.querySelector("td")?.text);
    if (k) out[k] = v;
  }
  return out;
}

/** The hidden _csrf value on a register page. */
export function idoxCsrf(html: string): string | null {
  return parse(html).querySelector("input[name=_csrf]")?.getAttribute("value") ?? null;
}

/** The weeks offered on the weekly list form, newest first ("26 Oct 2026"). */
export function idoxWeeks(html: string): string[] {
  return parse(html)
    .querySelectorAll("select#week option")
    .map((o) => o.getAttribute("value") ?? "")
    .filter(Boolean);
}

/**
 * The register's words for an application's type, in PlanIt's categories,
 * so the planning pages treat both sources alike.
 */
export function idoxAppType(type: string | null): string | null {
  const t = (type ?? "").toLowerCase();
  if (!t) return null;
  if (/discharge|approval of (details|conditions)|condition(s)? (discharge|compliance)/.test(t)) return "Conditions";
  if (/\btree|tpo\b|hedgerow/.test(t)) return "Trees";
  if (/non[- ]?material|minor material|amendment/.test(t)) return "Amendment";
  if (/listed building|conservation area consent|heritage|ancient monument/.test(t)) return "Heritage";
  if (/advert/.test(t)) return "Advertising";
  if (/telecom/.test(t)) return "Telecoms";
  if (/outline/.test(t)) return "Outline";
  if (/certificate|lawful|prior (approval|notification)|screening|scoping|notification|agricultural determination|consultation|county matter|demolition determination/.test(t)) return "Other";
  if (/householder|full|planning permission|change of use|variation|removal of condition|reserved matters|minor|major|section 73|s73|retrospective/.test(t)) return "Full";
  return "Other";
}

/**
 * The application's state in PlanIt's words: Permitted, Conditions,
 * Rejected, Withdrawn, Undecided, or Unresolved when the register says it is
 * decided but the decision isn't one we recognise.
 */
export function idoxAppState(status: string | null, decision: string | null): string {
  const s = (status ?? "").toLowerCase();
  const d = (decision ?? "").toLowerCase();
  if (/withdrawn/.test(d) || /withdrawn/.test(s)) return "Withdrawn";
  if (/refus|reject|declin|unacceptable|not acceptable/.test(d)) return "Rejected";
  // "Prior approval required" or "permission required" means a further application is needed: no outcome yet.
  if (/\brequired\b/.test(d) && !/not required/.test(d) && !/grant|approved\b|given/.test(d)) return "Unresolved";
  // Conditions: discharged is approval; partly or not discharged is not.
  if (/not discharged|partial/.test(d)) return "Unresolved";
  if (/discharged/.test(d)) return "Permitted";
  if (/approv|grant|permit|consent|allowed|no objection|acceptable|lawful|not required/.test(d)) return /condition/.test(d) ? "Conditions" : "Permitted";
  if (d) return "Unresolved";
  if (/pending|awaiting|registered|under consideration|in progress|in review|under review|processing|valid|consultation|current/.test(s)) return "Undecided";
  return "Unresolved";
}

/** The first UK postcode in an address. */
export function postcodeIn(address: string | null): string | null {
  const m = (address ?? "").toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/);
  return m ? `${m[1]} ${m[2]}` : null;
}
