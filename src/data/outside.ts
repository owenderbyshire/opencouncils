import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { rows, sql } from "./db";

/**
 * Data about councils from other open sources: party balance from Open Council Data UK and climate plans from
 * mySociety's CAPE. Both are refreshed weekly by the pipeline ("compositions", "climate").
 */

export interface Composition {
  councilId: string;
  year: number;
  seats: number;
  parties: { label: string; partyId: string | null; seats: number }[];
  control: string | null;
}

/** Every council's latest party balance. */
export async function listCompositions(): Promise<Composition[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("reference");
  return rows<Composition>(sql`
    select distinct on (council_id) council_id as "councilId", year, seats, parties, control
    from council_compositions order by council_id, year desc
  `);
}

export async function getComposition(councilId: string): Promise<Composition | null> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("reference");
  const [c] = await rows<Composition>(sql`
    select council_id as "councilId", year, seats, parties, control
    from council_compositions where council_id = ${councilId} order by year desc limit 1
  `);
  return c ?? null;
}

export interface Climate {
  capeUrl: string;
  planCount: number;
  planTitle: string | null;
  planUrl: string | null;
  plansLastUpdate: string | null;
  declaredEmergency: string | null;
  carbonNeutral: string | null;
}

export async function getClimate(councilId: string): Promise<Climate | null> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("reference");
  const [c] = await rows<Climate>(sql`
    select cape_url as "capeUrl", plan_count as "planCount", plan_title as "planTitle", plan_url as "planUrl",
      plans_last_update::text as "plansLastUpdate", declared_emergency::text as "declaredEmergency", carbon_neutral as "carbonNeutral"
    from council_climate where council_id = ${councilId}
  `);
  return c ?? null;
}

/**
 * Who has the most seats, from Open Council Data's description: "Lab" (a majority), "Lab plurality" (the largest
 * party without a majority), "Other" (independents and local groups together). "other" stands for independents and
 * local groups. Null for anything else, which the page then leaves out.
 */
export function controlOf(control: string | null): { partyId: string; majority: boolean } | null {
  if (!control) return null;
  const m = control.trim().match(/^([A-Za-z]+)(\s+plurality)?$/);
  if (!m) return null;
  const code = m[1].toLowerCase();
  const ids: Record<string, string> = { lab: "lab", con: "con", ld: "ld", green: "green", grn: "green", ref: "reform", reform: "reform", snp: "snp", pc: "pc", ind: "other", other: "other", oth: "other" };
  const partyId = ids[code];
  return partyId ? { partyId, majority: !m[2] } : null;
}

/** The council's page on WhatDoTheyKnow, or null if we don't have it. */
export async function getWdtkUrl(councilId: string): Promise<string | null> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("reference");
  const [r] = await rows<{ urlName: string }>(sql`select url_name as "urlName" from council_wdtk where council_id = ${councilId}`);
  return r ? `https://www.whatdotheyknow.com/body/${encodeURIComponent(r.urlName)}` : null;
}
