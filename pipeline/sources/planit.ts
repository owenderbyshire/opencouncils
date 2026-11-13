/**
 * UK PlanIt (planit.org.uk): planning applications gathered from every UK
 * planning authority's own register. Its terms allow any reuse without
 * attribution; it asks for no more than about one request a minute and 300 a
 * day, run overnight, from a user agent that carries an email address.
 *
 *   GET /api/areas/json            the authorities PlanIt covers
 *   GET /api/applics/json?auth=... applications, newest first, up to 5,000 a page
 */
import { PLANNING_AUTHORITIES, type PlanningAuthority } from "../../data/curated/planning-authorities";

export const PLANIT = "https://www.planit.org.uk";

export interface PlanitArea {
  area_id: number;
  area_name: string;
  long_name?: string | null;
  area_type?: string | null;
  scraper_type?: string | null;
  max_date?: string | null;
}

export interface Application {
  name: string;
  authority: string;
  reference: string | null;
  address: string | null;
  postcode: string | null;
  description: string | null;
  appType: string | null;
  appState: string | null;
  appSize: string | null;
  startDate: string | null;
  consultedDate: string | null;
  decidedDate: string | null;
  targetDate: string | null;
  decision: string | null;
  decidedBy: string | null;
  ward: string | null;
  homes: number | null;
  lat: number | null;
  lng: number | null;
  url: string | null;
  docsUrl: string | null;
  commentUrl: string | null;
  planitLink: string | null;
  lastChanged: Date | null;
}

const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Matches each of our authorities to its PlanIt area: by PlanIt's number, or failing that by name. */
export function matchAreas(areas: PlanitArea[]): Map<string, PlanitArea> {
  const out = new Map<string, PlanitArea>();
  for (const a of PLANNING_AUTHORITIES) {
    const wanted = new Set(a.planit.map(fold));
    const hit =
      areas.find((x) => x.area_id === a.planitId) ??
      areas.find((x) => /welsh|national park/i.test(x.area_type ?? "") && (wanted.has(fold(x.area_name)) || wanted.has(fold(x.long_name ?? ""))));
    if (hit) out.set(a.id, hit);
  }
  return out;
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const day = (v: unknown): string | null => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** One PlanIt record as an application of ours. Records without a name are dropped. */
export function toApplication(authority: PlanningAuthority, r: Record<string, unknown>): Application | null {
  const name = str(r.name);
  if (!name) return null;
  const other = (r.other_fields && typeof r.other_fields === "object" ? r.other_fields : {}) as Record<string, unknown>;
  const loc = r.location as { coordinates?: [number, number] } | null | undefined;
  const lng = num(r.location_x) ?? num(loc?.coordinates?.[0]);
  const lat = num(r.location_y) ?? num(loc?.coordinates?.[1]);
  const changed = str(r.last_changed);
  return {
    name,
    authority: authority.id,
    reference: str(r.reference) ?? str(r.uid),
    address: str(r.address),
    postcode: str(r.postcode),
    description: str(r.description),
    appType: str(r.app_type),
    appState: str(r.app_state),
    appSize: str(r.app_size),
    startDate: day(r.start_date),
    consultedDate: day(r.consulted_date),
    decidedDate: day(r.decided_date),
    targetDate: day(other.target_decision_date),
    decision: str(other.decision),
    decidedBy: str(other.decided_by),
    ward: str(other.ward_name),
    homes: num(other.n_dwellings),
    // Only places inside Wales and its borders.
    lat: lat !== null && lat > 51.3 && lat < 53.5 ? lat : null,
    lng: lng !== null && lng > -5.5 && lng < -2.6 ? lng : null,
    url: str(r.url),
    docsUrl: str(other.docs_url),
    commentUrl: str(other.comment_url),
    planitLink: str(r.link),
    lastChanged: changed && !Number.isNaN(Date.parse(changed)) ? new Date(changed) : null,
  };
}

/** Applications per page: small enough for PlanIt's 1,000 kB reply limit and 45-second query limit. */
export const PAGE = 200;

export function applicsUrl(area: string, params: Record<string, string | number>): string {
  const q = new URLSearchParams({ auth: area, pg_sz: String(PAGE), select: "*", ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  return `${PLANIT}/api/applics/json?${q}`;
}
