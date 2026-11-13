/**
 * What the watchdogs have published about each council, read from Edau's
 * watchdogs feed (`/api/v1/feed/watchdogs?org=<ONS code>`): the Auditor
 * General's reports about the council, published by Audit Wales, and the
 * Public Services Ombudsman for Wales's annual letters to it. Edau collects
 * both and links each to the council; OpenCouncil keeps a copy.
 *
 * Only known fields are kept and every address must be https. A report's AI
 * reading (Edau's findings checked against the page each cites) is kept only
 * when Edau marks it as written by AI, so it can never be shown unlabelled.
 */
import { fetchJson } from "../lib/http";
import type { EdauFeed } from "./edau";

/** ONS codes of the 22 councils, by OpenCouncil id (as in src/data/postcode.ts, which the pipeline cannot import). */
export const COUNCIL_ONS: Record<string, string> = {
  anglesey: "W06000001",
  gwynedd: "W06000002",
  conwy: "W06000003",
  denbighshire: "W06000004",
  flintshire: "W06000005",
  wrexham: "W06000006",
  ceredigion: "W06000008",
  pembrokeshire: "W06000009",
  carmarthenshire: "W06000010",
  swansea: "W06000011",
  "neath-port-talbot": "W06000012",
  bridgend: "W06000013",
  "vale-of-glamorgan": "W06000014",
  cardiff: "W06000015",
  "rhondda-cynon-taf": "W06000016",
  caerphilly: "W06000018",
  "blaenau-gwent": "W06000019",
  torfaen: "W06000020",
  monmouthshire: "W06000021",
  newport: "W06000022",
  powys: "W06000023",
  "merthyr-tydfil": "W06000024",
};

export interface Bi {
  en: string;
  cy: string | null;
}

export interface AuditFinding {
  /** recommendation, risk, spend, decision or figure. */
  kind: string;
  text: Bi;
  page: number;
  /** The page of the report's PDF the finding rests on. */
  sourceUrl: string | null;
}

export interface AuditReport {
  id: string;
  title: Bi;
  date: string;
  /** Audit Wales's own name for the kind of report. */
  kind: string | null;
  /** Audit Wales's own short summary. */
  summary: { en: string | null; cy: string | null };
  url: Bi;
  pdf: { en: string | null; cy: string | null };
  /** Findings Edau's AI read from the report, each checked against its page. Null when there are none. */
  aiReading: { findings: AuditFinding[]; total: number } | null;
  ownerCredit: string;
}

export interface AnnualLetter {
  year: string;
  url: string;
  ownerCredit: string;
}

export interface CouncilWatchdogs {
  reports: AuditReport[];
  letters: AnnualLetter[];
}

const https = (v: unknown): string | null => (typeof v === "string" && /^https:\/\/[^\s]+$/.test(v) ? v : null);
const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR = /^\d{4}-\d{2}$/;

function report(raw: unknown): AuditReport | null {
  const r = obj(raw);
  const title = obj(r.title);
  const url = obj(r.url);
  const pdf = obj(r.pdf);
  const summary = obj(r.publisher_summary);
  const titleEn = text(title.en);
  const urlEn = https(url.en);
  const date = typeof r.date === "string" && DATE.test(r.date) ? r.date : null;
  const id = text(r.id);
  const ownerCredit = text(r.owner_credit);
  if (!id || !titleEn || !urlEn || !date || !ownerCredit) return null;
  const ai = obj(r.ai_reading);
  const findings =
    ai.written_by === "ai" && Array.isArray(ai.findings)
      ? ai.findings.flatMap((f): AuditFinding[] => {
          const x = obj(f);
          const t = obj(x.text);
          const en = text(t.en);
          const page = typeof x.page === "number" && Number.isInteger(x.page) && x.page > 0 ? x.page : null;
          const kind = text(x.kind);
          if (!en || !page || !kind) return [];
          return [{ kind, text: { en, cy: text(t.cy) }, page, sourceUrl: https(x.source_url) }];
        })
      : [];
  return {
    id,
    title: { en: titleEn, cy: text(title.cy) },
    date,
    kind: text(r.kind),
    summary: { en: text(summary.en), cy: text(summary.cy) },
    url: { en: urlEn, cy: https(url.cy) },
    pdf: { en: https(pdf.en), cy: https(pdf.cy) },
    aiReading: findings.length ? { findings, total: Math.max(findings.length, typeof ai.findings_total === "number" ? ai.findings_total : 0) } : null,
    ownerCredit,
  };
}

/** The feed's reply as OpenCouncil keeps it: known fields only, newest first. Throws when the reply is not the watchdogs feed. */
export function tidyWatchdogs(raw: unknown): CouncilWatchdogs {
  const body = obj(raw);
  if (body.feed !== "watchdogs" || !Array.isArray(body.audit_reports) || !Array.isArray(body.ombudsman_letters)) {
    throw new Error("Edau's reply is not the watchdogs feed");
  }
  const reports = body.audit_reports.map(report).filter((r): r is AuditReport => r !== null);
  const letters = body.ombudsman_letters.flatMap((raw): AnnualLetter[] => {
    const l = obj(raw);
    const year = typeof l.year === "string" && YEAR.test(l.year) ? l.year : null;
    const url = https(l.url);
    const ownerCredit = text(l.owner_credit);
    return year && url && ownerCredit ? [{ year, url, ownerCredit }] : [];
  });
  // One letter a year: Edau may hold the same year twice if the Ombudsman moved the file.
  const byYear = new Map<string, AnnualLetter>();
  for (const l of letters) if (!byYear.has(l.year)) byYear.set(l.year, l);
  return {
    reports: reports.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)),
    letters: [...byYear.values()].sort((a, b) => b.year.localeCompare(a.year)),
  };
}

/** One council's watchdog records from Edau. */
export async function readWatchdogs(feed: EdauFeed, onsCode: string): Promise<{ ok: true; data: CouncilWatchdogs } | { ok: false; error: string }> {
  const r = await fetchJson<unknown>(`${feed.base}/watchdogs?org=${encodeURIComponent(onsCode)}`, { headers: { Authorization: `Bearer ${feed.key}` }, fresh: true });
  if (!r.ok) return { ok: false, error: `Edau: ${r.error}` };
  try {
    return { ok: true, data: tidyWatchdogs(r.data) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
