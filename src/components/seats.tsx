import type { PartySeats } from "@/data/elections";
import type { Locale } from "@/i18n/config";
import { formatNumber } from "@/i18n/format";
import { partyColour, partyName } from "@/lib/parties";
import { seatGroups } from "@/lib/seats";

export interface SeatPart {
  key: string;
  label: string;
  seats: number;
  colour: string;
}

const ORDER = ["lab", "pc", "con", "ld", "reform", "green", "ind", "other"];

/**
 * Seats by national party, with independents, local groups and unrecorded
 * labels together. Councils label independent groups in many ways ("Powys
 * Independents", "Not affiliated to any group"), so splitting independents from
 * local groups would compare labels rather than seats.
 */
export function partsFrom(locale: Locale, rows: Array<{ partyId: string | null; seats: number }>, otherLabel: string): SeatPart[] {
  const by = new Map<string, number>();
  for (const r of rows) {
    const key = r.partyId && r.partyId !== "ind" && ORDER.includes(r.partyId) ? r.partyId : "other";
    by.set(key, (by.get(key) ?? 0) + r.seats);
  }
  return [...by]
    .filter(([, n]) => n > 0)
    .sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))
    .map(([key, seats]) => ({
      key,
      label: key === "other" ? otherLabel : partyName(locale, key, null),
      seats,
      colour: partyColour(key === "other" ? null : key),
    }));
}

/** 2022 results use the same ids; local groups have their own names and count as "other". */
export function partsFrom2022(locale: Locale, seats: Record<string, number>, otherLabel: string): SeatPart[] {
  return partsFrom(
    locale,
    Object.entries(seats).map(([partyId, n]) => ({ partyId, seats: n })),
    otherLabel,
  );
}

export function rowsFor(all: PartySeats[], councilId?: string) {
  return all.filter((r) => !councilId || r.councilId === councilId);
}

/**
 * Whether a council's list of councillors records any party or group.
 * Wrexham's records none, and counting its 56 seats as "independents and
 * local groups" would be wrong, so its seats are left out of party splits.
 */
export function recordsParties(rows: PartySeats[]): boolean {
  return seatGroups(rows, null).groups.length > 0;
}

/** A stacked bar of seats with a legend giving each party's number, so colour is never the only signal. */
export function SeatsBar({ locale, parts, label, compact = false }: { locale: Locale; parts: SeatPart[]; label: string; compact?: boolean }) {
  const total = parts.reduce((n, p) => n + p.seats, 0);
  if (!total) return null;
  return (
    <figure>
      <figcaption className="visually-hidden">{label}</figcaption>
      <div className={`flex overflow-hidden rounded-sm ${compact ? "h-3" : "h-6"}`} aria-hidden="true">
        {parts.map((p) => (
          <div key={p.key} style={{ width: `${(p.seats / total) * 100}%`, background: p.colour }} title={`${p.label}: ${p.seats}`} />
        ))}
      </div>
      <ul className={`flex flex-wrap gap-x-5 gap-y-1 ${compact ? "mt-1 text-meta" : "mt-3 text-small"}`}>
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: p.colour }} />
            <span>
              {p.label} <span className="font-semibold num">{formatNumber(locale, p.seats)}</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
