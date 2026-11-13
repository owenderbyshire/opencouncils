import Link from "next/link";
import { href, type Locale } from "@/i18n/config";
import { formatList } from "@/i18n/format";
import { walesMessages } from "@/i18n/messages/wales";
import { COUNCILS, councilShort } from "@/lib/councils";
import { ChamberThumb, type ChamberGroup } from "./chamber";

export type CouncilStatus = "covered" | "adding" | "planned";

/**
 * Wales as 22 hexagons, one per council, placed roughly where each council
 * is: Anglesey at the top, Cardigan Bay as the notch on the west, the valleys
 * running east along the bottom. Positions are hex columns; odd rows shift
 * half a hexagon right. Codes are the three-letter council codes the Welsh
 * Government uses. ControlMap draws them; the list says the same in words.
 */
export const TILES: Array<{ id: string; code: string; row: number; col: number }> = [
  { id: "anglesey", code: "AGY", row: 0, col: 1 },
  { id: "gwynedd", code: "GWN", row: 1, col: 1 },
  { id: "conwy", code: "CWY", row: 1, col: 2 },
  { id: "denbighshire", code: "DEN", row: 1, col: 3 },
  { id: "flintshire", code: "FLN", row: 1, col: 4 },
  { id: "ceredigion", code: "CGN", row: 2, col: 2 },
  { id: "powys", code: "POW", row: 2, col: 3 },
  { id: "wrexham", code: "WRX", row: 2, col: 4 },
  { id: "pembrokeshire", code: "PEM", row: 3, col: 0 },
  { id: "carmarthenshire", code: "CMN", row: 3, col: 1 },
  { id: "neath-port-talbot", code: "NPT", row: 3, col: 2 },
  { id: "merthyr-tydfil", code: "MTY", row: 3, col: 3 },
  { id: "blaenau-gwent", code: "BGW", row: 3, col: 4 },
  { id: "monmouthshire", code: "MON", row: 3, col: 5 },
  { id: "swansea", code: "SWA", row: 4, col: 2 },
  { id: "bridgend", code: "BGE", row: 4, col: 3 },
  { id: "rhondda-cynon-taf", code: "RCT", row: 4, col: 4 },
  { id: "caerphilly", code: "CAY", row: 4, col: 5 },
  { id: "torfaen", code: "TOF", row: 4, col: 6 },
  { id: "vale-of-glamorgan", code: "VGL", row: 5, col: 3 },
  { id: "cardiff", code: "CRF", row: 5, col: 4 },
  { id: "newport", code: "NWP", row: 5, col: 5 },
];

export const R = 34; // hexagon radius (centre to corner)
export const W = Math.sqrt(3) * R; // width of a pointy-top hexagon
export const H = 1.5 * R; // vertical distance between rows

export function hexPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

/**
 * Every council, with a small chamber of its groups. A covered council is a
 * link; only the others carry a line saying how far OpenCouncil covers them,
 * so a list where every council is covered reads as 22 names. On phones the
 * 22 rows would push the rest of the page two screens down and the small
 * chambers are too small to read, so below `sm` the covered councils are a
 * row of links and the others a line of names.
 */
export function CouncilList({
  locale,
  status,
  chambers = {},
  narrow = false,
}: {
  locale: Locale;
  status: Record<string, CouncilStatus>;
  /** Each council's groups, for a small chamber beside its name. */
  chambers?: Record<string, ChamberGroup[]>;
  narrow?: boolean;
}) {
  const t = walesMessages[locale].map;
  const collation = locale === "cy" ? "cy" : "en";
  const sorted = [...COUNCILS].sort((a, b) => councilShort(locale, a).localeCompare(councilShort(locale, b), collation));
  const of = (s: CouncilStatus) => sorted.filter((c) => (status[c.id] ?? "planned") === s);
  const covered = of("covered");
  return (
    <>
      <div className="sm:hidden">
        {covered.length ? (
          <ul className="flex flex-wrap gap-2">
            {covered.map((c) => (
              <li key={c.id}>
                <Link href={href(locale, `/${c.id}`)} className="chip font-medium text-ink">
                  {councilShort(locale, c)}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {(["adding", "planned"] as const).map((s) => {
          const names = of(s).map((c) => councilShort(locale, c));
          return names.length ? (
            <p key={s} className="mt-3 text-meta text-ink-2">
              {t.compact[s].replace("{list}", formatList(locale, names, { places: true }))}
            </p>
          ) : null;
        })}
      </div>
      <ul className={`hidden gap-x-6 text-small sm:grid sm:grid-cols-2 ${narrow ? "" : "lg:grid-cols-3"}`}>
        {sorted.map((c) => {
          const s = status[c.id] ?? "planned";
          return (
            <li key={c.id} className="flex min-h-12 items-center gap-2.5 border-b border-rule py-1">
              <ChamberThumb locale={locale} name={councilShort(locale, c)} groups={chambers[c.id] ?? []} />
              <span className="min-w-0 leading-tight">
                {s === "covered" ? (
                  <Link href={href(locale, `/${c.id}`)} className="font-semibold">
                    {councilShort(locale, c)}
                  </Link>
                ) : (
                  <>
                    <span>{councilShort(locale, c)}</span>
                    <span className="block text-meta text-ink-2">{t.status[s]}</span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
