import type { PartySeats } from "@/data/elections";
import type { Locale } from "@/i18n/config";
import { formatList, formatNumber } from "@/i18n/format";
import { graphicsMessages } from "@/i18n/messages/graphics";
import { chamberSeats } from "@/lib/chamber";
import { seatGroups } from "@/lib/seats";
import { partyColour, partyName } from "@/lib/parties";

/** One group in the chamber: a national party, independents, a local group under its own name, or empty seats. */
export interface ChamberGroup {
  key: string;
  label: string;
  seats: number;
  colour: string;
  vacant?: boolean;
}

/**
 * A council's groups from its current councillors, counted by seatGroups()
 * (src/lib/seats.ts), as the council overviews count them. National parties
 * take their colour; independents and local groups share the independent grey
 * and keep the council's own label. Seats beyond the councillors listed, up to
 * the council's size, are shown as empty. Nothing when the council's list
 * records no parties (Wrexham's, at present).
 */
export function chamberGroups(locale: Locale, rows: PartySeats[], size: number | null): ChamberGroup[] {
  const t = graphicsMessages[locale].chamber;
  const { groups, vacant } = seatGroups(rows, size);
  const out: ChamberGroup[] = groups.map((g) => ({
    key: g.key,
    label: partyName(locale, g.partyId, g.label),
    seats: g.seats,
    colour: g.kind === "local" ? partyColour("ind") : partyColour(g.partyId),
  }));
  if (vacant) out.push({ key: "vacant", label: t.vacant, seats: vacant, colour: "var(--rule-strong)", vacant: true });
  return out;
}

/** The groups in words: "Labour 55, Conservative 11 and Plaid Cymru 2". */
export function chamberWords(locale: Locale, groups: ChamberGroup[]): string {
  const t = graphicsMessages[locale].chamber;
  return formatList(
    locale,
    groups.map((g) => t.seats.replace("{label}", g.label).replace("{n}", formatNumber(locale, g.seats))),
  );
}

/** The dots. Empty seats are rings, so a gap reads as a gap and not as a group. */
function ChamberSvg({ groups, label, className }: { groups: ChamberGroup[]; label: string; className: string }) {
  const total = groups.reduce((n, g) => n + g.seats, 0);
  const { seats, radius } = chamberSeats(total);
  const pad = radius * 1.4;
  let i = 0;
  const dots = groups.flatMap((g) =>
    Array.from({ length: g.seats }, () => {
      const s = seats[i++];
      return g.vacant ? (
        <circle key={i} cx={s.x} cy={s.y} r={radius * 0.82} fill="none" stroke={g.colour} strokeWidth={radius * 0.32} />
      ) : (
        <circle key={i} cx={s.x} cy={s.y} r={radius} fill={g.colour} />
      );
    }),
  );
  return (
    <svg
      viewBox={`${-pad} ${-pad} ${2 + pad * 2} ${1 + pad * 2}`}
      role="img"
      aria-label={label}
      className={className}
    >
      {dots}
    </svg>
  );
}

/** A council's chamber: the diagram, a legend with every group's seats, and the same in a sentence for screen readers. */
export function Chamber({ locale, name, groups }: { locale: Locale; name: string; groups: ChamberGroup[] }) {
  const t = graphicsMessages[locale].chamber;
  const total = groups.reduce((n, g) => n + g.seats, 0);
  if (!total) return null;
  const vacant = groups.find((g) => g.vacant)?.seats ?? 0;
  const summary = t.summary
    .replace("{name}", name)
    .replace("{total}", formatNumber(locale, total))
    .replace("{list}", chamberWords(locale, groups));
  return (
    <figure className="grid items-center gap-x-8 gap-y-4 sm:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <ChamberSvg groups={groups} label={summary} className="block h-auto w-full max-w-[22rem]" />
      <figcaption className="max-w-[24rem] text-small">
        <ul className="grid gap-y-1">
          {groups.map((g) => (
            <li key={g.key} className="flex items-baseline gap-2">
              <span
                aria-hidden="true"
                className="inline-block size-2.5 shrink-0 translate-y-[1px] rounded-full"
                style={g.vacant ? { border: `2px solid ${g.colour}` } : { background: g.colour }}
              />
              <span className="min-w-0">{g.label}</span>
              <span className="ml-auto pl-3 font-semibold num">{formatNumber(locale, g.seats)}</span>
            </li>
          ))}
        </ul>
        {vacant ? (
          <p className="mt-3 text-meta text-ink-2">
            {vacant === 1 ? t.vacantOne : t.vacantMany.replace("{n}", formatNumber(locale, vacant))}
          </p>
        ) : null}
        <p className="mt-2 text-meta text-ink-3">{t.source}</p>
      </figcaption>
    </figure>
  );
}

/** A small chamber for lists of councils, with the groups in its label. */
export function ChamberThumb({ locale, name, groups }: { locale: Locale; name: string; groups: ChamberGroup[] }) {
  // Keeps names in line when a council's councillors are not listed yet.
  if (!groups.length) return <span aria-hidden="true" className="block h-5 w-9 shrink-0" />;
  const label = graphicsMessages[locale].chamber.thumb.replace("{name}", name).replace("{list}", chamberWords(locale, groups));
  return <ChamberSvg groups={groups} label={label} className="block h-5 w-9 shrink-0" />;
}
