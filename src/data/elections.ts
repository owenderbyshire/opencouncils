import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ELECTION_DAY } from "@data/curated/elections";
import { ukToday } from "@/i18n/format";
import { currentSeatsQuery } from "@/lib/seats-query";
import type { Elections2022State } from "../../pipeline/jobs/election-results";
import { margins, partyChanges, type Margin, type PartyChange } from "../../pipeline/sources/election-results";
import { rows, sql } from "./db";

/** Seats held now, from each council's own list of current councillors. */
export interface PartySeats {
  councilId: string;
  partyId: string | null;
  label: string | null;
  seats: number;
}

export async function seatsNow(): Promise<PartySeats[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("councillors");
  // The council overviews count seats with the same query (pipeline/jobs/council-briefs.ts).
  return rows<PartySeats>(currentSeatsQuery());
}

/** Days from today (UK) to polling day; 0 on the day, negative afterwards. */
export async function daysToElection(): Promise<number> {
  "use cache";
  cacheLife("hours");
  const today = ukToday();
  return Math.round((Date.parse(`${ELECTION_DAY}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export interface WardWithCouncillors {
  slug: string;
  nameEn: string;
  nameCy: string | null;
  seats: number | null;
  councillors: Array<{ id: number; name: string; partyId: string | null; partyLabel: string | null }>;
}

/** Every ward with its current councillors, for a council's election page. */
export async function wardsWithCouncillors(councilId: string): Promise<WardWithCouncillors[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("councillors");
  return rows<WardWithCouncillors>(sql`
    select w.slug, w.name_en as "nameEn", w.name_cy as "nameCy", w.seats,
      coalesce((select json_agg(json_build_object('id', p.id, 'name', p.name, 'partyId', p.party_id, 'partyLabel', p.party_label) order by p.name)
        from councillors p where p.council_id = w.council_id and p.ward_slug = w.slug and p.current), '[]'::json) as councillors
    from wards w where w.council_id = ${councilId}
      and exists (select 1 from councillors p where p.council_id = w.council_id and p.ward_slug = w.slug and p.current)
    order by w.name_en`);
}

/** A council by-election since May 2022, from Open Council Data's archive (pipeline/jobs/by-elections.ts). */
export interface ByElectionRow {
  date: string;
  councilId: string;
  ward: string;
  from: string;
  to: string;
  fromParty: string | null;
  toParty: string | null;
  source: string;
}

export async function byElections(): Promise<{ updatedAt: string; rows: ByElectionRow[] } | null> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("reference");
  const r = await rows<{ value: { updatedAt: string; rows: ByElectionRow[] } }>(
    sql`select value from pipeline_state where key = 'by-elections'`,
  ).catch(() => []);
  return r[0]?.value ?? null;
}

/** One council's May 2022 results, reduced to what the elections pages show. */
export interface Council2022 {
  councilId: string;
  electionId: number;
  page: string | null;
  /** True when the results pass every check (pipeline/sources/election-results.ts checkResults). */
  covered: boolean;
  problems: string[];
  wards: number;
  contested: number;
  margins: Margin[];
  changes: PartyChange[];
}

/**
 * The May 2022 results saved by the election-results job, with each covered
 * council's closest wards and the councillors now sitting for a different
 * party from the one they were elected for.
 */
export async function results2022(): Promise<{ updatedAt: string; councils: Council2022[]; notFound: string[] } | null> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("reference", "councillors");
  const r = await rows<{ value: Elections2022State }>(sql`select value from pipeline_state where key = 'elections-2022'`).catch(() => []);
  const state = r[0]?.value;
  if (!state) return null;
  const now = await rows<{ councilId: string; id: number; name: string; partyId: string | null; partyLabel: string | null }>(sql`
    select council_id as "councilId", id, name, party_id as "partyId", party_label as "partyLabel"
    from councillors where current and name !~* '^vacan(cy|t)\\b'`);
  return {
    updatedAt: state.updatedAt,
    notFound: state.notFound,
    councils: state.councils.map((c) => {
      const covered = c.problems.length === 0;
      const winners = c.wards.flatMap((w) => w.candidates.filter((x) => x.elected));
      return {
        councilId: c.councilId,
        electionId: c.electionId,
        page: c.page,
        covered,
        problems: c.problems,
        wards: c.wards.length,
        contested: c.wards.filter((w) => !w.uncontested).length,
        margins: covered ? margins(c.wards) : [],
        changes: covered ? partyChanges(winners, now.filter((p) => p.councilId === c.councilId)) : [],
      };
    }),
  };
}
