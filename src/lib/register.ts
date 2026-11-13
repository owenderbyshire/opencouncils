import reorganisation from "@data/curated/reorganisation.json";
import { CURRENT_COUNCILS, REGISTER, SHADOW_COUNCILS, registerEntry, type CouncilKind, type Nation, type RegisterEntry } from "@data/curated/councils";
import { liveCouncil } from "./councils";

export { CURRENT_COUNCILS, REGISTER, SHADOW_COUNCILS, registerEntry, type CouncilKind, type Nation, type RegisterEntry };

export const NATIONS: Nation[] = ["England", "Scotland", "Wales", "Northern Ireland"];
export const NATION_SLUGS: Record<string, Nation> = { england: "England", scotland: "Scotland", wales: "Wales", "northern-ireland": "Northern Ireland" };
export const nationSlug = (n: Nation) => n.toLowerCase().replace(/ /g, "-");

/** Kinds in the order lists show them. */
export const KINDS: CouncilKind[] = ["unitary", "county", "district", "metropolitan", "london-borough", "city-corporation"];

/** Where a council's page is: its full pages once live, otherwise its register page. */
export function councilPath(id: string): string {
  return liveCouncil(id) ? `/${id}` : `/councils/${id}`;
}

export function councilsIn(nation?: Nation, kind?: CouncilKind): RegisterEntry[] {
  return CURRENT_COUNCILS.filter((c) => (!nation || c.nation === nation) && (!kind || c.kind === kind));
}

export interface ReorgChange {
  id: string;
  area: string;
  status: "confirmed" | "paused" | "withdrawn";
  vestingDate: string;
  shadowElection: string | null;
  sources: string[];
  new: Array<{ id: string; name: string; short: string; replaces: string[] }>;
}

export const REORG_CHANGES = reorganisation.changes as ReorgChange[];
