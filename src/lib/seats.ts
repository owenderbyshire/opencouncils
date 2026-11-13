/**
 * How a council's seats are counted: by national party, with independents,
 * local groups under the council's own name, and "no party recorded". The
 * chamber diagram, the election pages and the council overviews written by
 * pipeline/jobs/council-briefs.ts all count with these rules and the query in
 * ./seats-query.ts, so the figures on a page agree with each other.
 */

/** Current councillors of one council grouped by party, as ./seats-query.ts returns them. */
export type PartySeatsRow = {
  partyId: string | null;
  /** The council's own label where there is no national party; "No party recorded" when there is neither. */
  label: string | null;
  seats: number;
};

export const NO_PARTY = "No party recorded";

/** Left to right across the chamber, roughly as Welsh councils sit. Local groups go after independents. */
export const CHAMBER_ORDER = ["lab", "pc", "green", "ld", "ind", "local", "none", "con", "reform"];

export interface SeatGroup {
  key: string;
  /** A national party's ID, "local" for a council's own group, or "none" when no party is recorded. */
  kind: string;
  partyId: string | null;
  /** The council's label for a local group; null when no party is recorded. */
  label: string | null;
  seats: number;
}

/**
 * A council's groups in chamber order, the councillors listed, and the seats
 * beyond them up to the council's size, which have no councillor listed. No
 * groups when no councillor has a party or group (Wrexham's list, at present):
 * one block of "no party recorded" says nothing about who sits on the council.
 */
export function seatGroups(rows: PartySeatsRow[], size: number | null): { groups: SeatGroup[]; listed: number; vacant: number } {
  const listed = rows.reduce((n, r) => n + r.seats, 0);
  const groups = rows.map((r) => {
    const none = !r.partyId && (!r.label || r.label === NO_PARTY);
    const kind = r.partyId && CHAMBER_ORDER.includes(r.partyId) ? r.partyId : none ? "none" : "local";
    return { key: r.partyId ?? `local:${r.label}`, kind, partyId: r.partyId, label: none ? null : r.label, seats: r.seats };
  });
  if (!groups.some((g) => g.kind !== "none")) return { groups: [], listed, vacant: 0 };
  groups.sort((a, b) => CHAMBER_ORDER.indexOf(a.kind) - CHAMBER_ORDER.indexOf(b.kind) || b.seats - a.seats);
  return { groups, listed, vacant: listed && size && size > listed ? size - listed : 0 };
}
