import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ukToday } from "@/i18n/format";
import { mergeSameSites } from "@/lib/ldp";
import { rows, sql } from "./db";

/**
 * What the `ldp` pipeline job read from each authority's Local Development
 * Plan documents (pipeline/jobs/ldp.ts). The plans themselves are listed in
 * data/curated/ldps.ts.
 */

export type LdpKind = "adopted" | "deposit" | "amr";

export interface LdpFact {
  authority: string;
  kind: LdpKind;
  key: string;
  value: number;
  url: string;
  page: number;
  quote: string;
  mentions: number;
}

export interface LdpSite {
  kind: LdpKind;
  ref: string | null;
  name: string;
  settlement: string | null;
  use: string;
  homes: number | null;
  hectares: number | null;
  url: string;
  page: number;
}

export interface LdpPoint {
  kind: LdpKind;
  topic: string;
  textEn: string;
  textCy: string;
  policy: string | null;
  url: string;
  page: number;
}

export interface LdpDocumentState {
  kind: LdpKind;
  url: string;
  pageCount: number | null;
  problem: string | null;
  fetchedAt: string;
}

/** Every headline figure, for the Wales table. */
export async function ldpFacts(): Promise<LdpFact[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("planning");
  return rows<LdpFact>(sql`
    select authority, kind, key, value::float8 as value, url, page, quote, mentions
    from ldp_facts order by authority, kind, key`);
}

export interface LdpDetail {
  facts: LdpFact[];
  sites: LdpSite[];
  points: LdpPoint[];
  documents: LdpDocumentState[];
}

export async function ldpDetail(authority: string): Promise<LdpDetail> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("planning");
  const [facts, sites, points, documents] = await Promise.all([
    rows<LdpFact>(sql`
      select authority, kind, key, value::float8 as value, url, page, quote, mentions
      from ldp_facts where authority = ${authority} order by kind, key`),
    rows<LdpSite>(sql`
      select kind, ref, name, settlement, use, homes, hectares::float8 as hectares, url, page
      from ldp_sites where authority = ${authority}
      order by kind, settlement nulls last, name`),
    rows<LdpPoint>(sql`
      select kind, topic, text_en as "textEn", text_cy as "textCy", policy, url, page
      from ldp_points where authority = ${authority} order by kind, topic, url, seq`),
    rows<LdpDocumentState>(sql`
      select kind, url, page_count as "pageCount", problem, fetched_at::text as "fetchedAt"
      from ldp_documents where authority = ${authority} order by kind, url`),
  ]);
  return { facts, sites: mergeSameSites([...sites]), points, documents };
}

export interface PlanMeeting {
  meetingId: number;
  date: string;
  committeeEn: string;
  committeeCy: string | null;
  itemTitle: string;
}

/** A council's meeting items about its development plan, newest first. */
export async function planMeetings(councilId: string, limit = 12): Promise<PlanMeeting[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("meetings");
  return rows<PlanMeeting>(sql`
    select m.id as "meetingId", m.date::text as date, c.name_en as "committeeEn", c.name_cy as "committeeCy",
      min(i.title) as "itemTitle"
    from agenda_items i
    join meetings m on m.council_id = i.council_id and m.id = i.meeting_id
    join committees c on c.council_id = m.council_id and c.id = m.committee_id
    where i.council_id = ${councilId} and not m.cancelled
      and (i.title ~* '(local|strategic) development plan|\\mR?LDP\\M|cynllun datblygu (lleol|strategol)')
    group by m.id, m.date, c.name_en, c.name_cy
    order by m.date desc limit ${limit}`);
}

/** Today's date, for saying whether a plan's period has ended. */
export async function planToday(): Promise<string> {
  "use cache";
  cacheLife("hours");
  return ukToday();
}

export interface AllocatedSite {
  authority: string;
  use: string;
  ref: string | null;
  name: string | null;
}

/** Allocated sites whose boundary contains the application's location (pipeline/jobs/ldp-areas.ts). */
export async function allocatedSitesFor(application: string): Promise<AllocatedSite[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("planning");
  return rows<AllocatedSite>(sql`
    select a.authority, a.use, a.ref, a.name
    from ldp_area_applications x join ldp_areas a on a.id = x.area_id
    where x.application = ${application} order by a.ref`);
}

export interface ApplicationOnSite {
  id: number;
  reference: string | null;
  address: string | null;
  description: string | null;
  startDate: string | null;
  use: string;
  siteRef: string | null;
  siteName: string | null;
}

/** Planning applications on an authority's allocated sites, newest first. */
export async function applicationsOnSites(authority: string, limit = 60): Promise<ApplicationOnSite[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("planning");
  return rows<ApplicationOnSite>(sql`
    select p.id, p.reference, p.address, p.description, p.start_date::text as "startDate",
      a.use, a.ref as "siteRef", a.name as "siteName"
    from ldp_area_applications x
    join ldp_areas a on a.id = x.area_id
    join planning_applications p on p.name = x.application
    where a.authority = ${authority}
    order by p.start_date desc nulls last limit ${limit}`);
}

/** Authorities with allocated sites' boundaries. */
export async function authoritiesWithAreas(): Promise<string[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("planning");
  return (await rows<{ authority: string }>(sql`select distinct authority from ldp_areas`)).map((r) => r.authority);
}
