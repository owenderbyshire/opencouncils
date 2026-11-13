/**
 * One decision, every council: the agenda item behind each council's row in
 * an issue table, matched by hand and kept here so a wrong match can be put
 * right and stays right.
 *
 * How a row was found (the rule, applied on 12 November 2026 to the search
 * index, then read by a person):
 * - council tax: the full Council's 2026-27 budget or council tax item,
 *   1 February to 15 March 2026, preferring the item whose summary states
 *   the rise; the Cabinet's recommendation is never used in its place.
 * - visitor levy: the latest decision of the full Council (or Cabinet where
 *   the Council has none) on a visitor levy, from 2025 on.
 *
 * A row with no `agendaItemId` means OpenCouncil holds no decision on this
 * in the council's minutes; `gap` says why, for the notes. The page reads
 * the summary sentence, the recorded decision and the date from the database
 * by (council, agendaItemId), so nothing here repeats what the minutes say.
 * `position` (visitor levy only) is a person's reading of that decision.
 * `later` points to a later meeting that took the matter up but whose
 * minutes, as held, record no decision yet.
 */

export type LevyPosition = "adopted" | "consulting" | "deferred" | "not-now";

export interface IssueCell {
  council: string;
  agendaItemId?: number;
  meetingId?: number;
  position?: LevyPosition;
  later?: { meetingId: number; agendaItemId: number; date: string };
  /** Why no row was found, in plain words, for the notes under the table. */
  gap?: "no-items" | "no-meeting" | "none-found";
  /** A summary that opens mid-thought ("It then...") is not shown on its own. */
  summaryLeansOnOthers?: boolean;
}

export interface IssueDef {
  slug: "council-tax-2026-27" | "visitor-levy";
  /** The topic page that links here (data/curated/topics.ts). */
  topic: string;
  checked: string;
  cells: IssueCell[];
}

export const COUNCIL_TAX_2026_27: IssueDef = {
  slug: "council-tax-2026-27",
  topic: "budget",
  checked: "2026-11-12",
  cells: [
    { council: "anglesey", meetingId: 4471, agendaItemId: 17698 },
    { council: "blaenau-gwent", meetingId: 2829, agendaItemId: 10243 },
    // The minutes held carry no text for any item of this meeting; Bridgend's record holds no decisions after January 2024.
    { council: "bridgend", meetingId: 4875, agendaItemId: 19511 },
    // Caerphilly's minutes for this meeting are not published in the record OpenCouncil reads.
    { council: "caerphilly", meetingId: 15028, agendaItemId: 34771 },
    { council: "cardiff", meetingId: 8822, agendaItemId: 39213 },
    { council: "carmarthenshire", meetingId: 9627, agendaItemId: 61579 },
    { council: "ceredigion", meetingId: 654, agendaItemId: 7296, summaryLeansOnOthers: true },
    // The Council met on 5 March 2026 (meeting 10742), but OpenCouncil holds no agenda items for it.
    { council: "conwy", gap: "no-items" },
    { council: "denbighshire", meetingId: 8310, agendaItemId: 30346 },
    { council: "flintshire", meetingId: 5978, agendaItemId: 33889 },
    // Gwynedd's full Council is filed as committee kind "other" in the record, so it is matched by hand.
    { council: "gwynedd", meetingId: 5677, agendaItemId: 32523 },
    { council: "merthyr-tydfil", meetingId: 6801, agendaItemId: 50340 },
    // A meeting on 6 March 2026 (6650) lists the same item; its minutes are not held. The 5 March minute records the vote.
    { council: "monmouthshire", meetingId: 6089, agendaItemId: 20562 },
    { council: "neath-port-talbot", meetingId: 12606, agendaItemId: 500000883 },
    { council: "newport", meetingId: 8904, agendaItemId: 13627 },
    { council: "pembrokeshire", meetingId: 6656, agendaItemId: 52848 },
    { council: "powys", meetingId: 9869, agendaItemId: 48046 },
    { council: "rhondda-cynon-taf", meetingId: 50005510, agendaItemId: 37904 },
    { council: "swansea", meetingId: 11973, agendaItemId: 57148 },
    // The Council met on 3 March 2026 (meeting 7396), but OpenCouncil holds no agenda items for it.
    { council: "torfaen", gap: "no-items" },
    { council: "vale-of-glamorgan", meetingId: 410805961, agendaItemId: 1847827756 },
    { council: "wrexham", meetingId: 10006, agendaItemId: 21467 },
  ],
};

export const VISITOR_LEVY: IssueDef = {
  slug: "visitor-levy",
  topic: "economy",
  checked: "2026-11-12",
  cells: [
    // Recorded decision: "that a public consultation process be undertaken". The Council took up the levy again on 24 September 2026.
    { council: "anglesey", meetingId: 4532, agendaItemId: 17977, position: "consulting", later: { meetingId: 4533, agendaItemId: 18191, date: "2026-09-24" } },
    { council: "blaenau-gwent", gap: "none-found" },
    { council: "bridgend", gap: "none-found" },
    { council: "caerphilly", gap: "none-found" },
    { council: "cardiff", meetingId: 8811, agendaItemId: 39436, position: "adopted" },
    { council: "carmarthenshire", gap: "none-found" },
    { council: "ceredigion", gap: "none-found" },
    { council: "conwy", meetingId: 11190, agendaItemId: 128691, position: "deferred" },
    { council: "denbighshire", gap: "none-found" },
    { council: "flintshire", gap: "none-found" },
    { council: "gwynedd", meetingId: 5543, agendaItemId: 33858, position: "consulting", later: { meetingId: 6855, agendaItemId: 35513, date: "2026-09-24" } },
    { council: "merthyr-tydfil", gap: "none-found" },
    { council: "monmouthshire", gap: "none-found" },
    { council: "neath-port-talbot", gap: "none-found" },
    { council: "newport", gap: "none-found" },
    { council: "pembrokeshire", gap: "none-found" },
    // Recorded decision: "not implement a visitor levy at this stage", with a period of engagement and a further report to Council.
    { council: "powys", meetingId: 8971, agendaItemId: 45966, position: "not-now" },
    { council: "rhondda-cynon-taf", gap: "none-found" },
    { council: "swansea", gap: "none-found" },
    { council: "torfaen", gap: "none-found" },
    { council: "vale-of-glamorgan", gap: "none-found" },
    { council: "wrexham", gap: "none-found" },
  ],
};

export const ISSUES: IssueDef[] = [COUNCIL_TAX_2026_27, VISITOR_LEVY];

export function issueBySlug(slug: string): IssueDef | undefined {
  return ISSUES.find((i) => i.slug === slug);
}
