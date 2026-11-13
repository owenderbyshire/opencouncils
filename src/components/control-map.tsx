import Link from "next/link";
import { COUNCIL_ELECTIONS, ELECTIONS_AS_OF, type CouncilElection } from "@data/curated/elections";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatList, formatNumber } from "@/i18n/format";
import { electionMessages } from "@/i18n/messages/elections";
import { graphicsMessages } from "@/i18n/messages/graphics";
import { Rich } from "@/i18n/rich";
import { softMutate } from "@/i18n/welsh";
import { COUNCILS, councilShort } from "@/lib/councils";
import { partyColour, partyName } from "@/lib/parties";
import { H, hexPoints, R, TILES, W } from "./wales-map";

const ORDER = ["lab", "pc", "ld", "ind", "con", "reform", "green"];

/** "Independents" for a council run by independents, otherwise the party's name. */
function runner(locale: Locale, party: string): string {
  return party === "ind" ? electionMessages[locale].independents : partyName(locale, party, null);
}

/** Stripes in a party's colour on the page colour, for a council run without a majority. */
function Stripes({ party }: { party: string }) {
  return (
    <pattern id={`stripes-${party}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="7" height="7" fill="var(--bg)" />
      <rect width="4" height="7" fill={partyColour(party)} />
    </pattern>
  );
}

function fill(e: CouncilElection | undefined): { fill: string; stroke: string; dash?: string } {
  if (!e || e.control.kind === "disputed") return { fill: "var(--map-none)", stroke: "var(--ink-3)", dash: "3 3" };
  if (e.control.kind === "majority") return { fill: partyColour(e.control.party), stroke: partyColour(e.control.party) };
  return { fill: `url(#stripes-${e.control.party})`, stroke: partyColour(e.control.party) };
}

/**
 * Wales's 22 councils as hexagons, each in the colour of the party or group
 * that runs it (data/curated/elections.ts): solid for a majority, striped
 * without one, and a dashed gap where the sources differ. The list after the
 * map says the same in words.
 */
export function ControlMap({ locale, linked }: { locale: Locale; linked: Set<string> }) {
  const t = graphicsMessages[locale].control;
  const pad = 6;
  const by = new Map(COUNCIL_ELECTIONS.map((e) => [e.id, e]));
  const name = (id: string) => {
    const c = COUNCILS.find((x) => x.id === id);
    return c ? councilShort(locale, c) : id;
  };
  const cells = TILES.map((tile) => ({
    ...tile,
    cx: pad + W / 2 + tile.col * W + (tile.row % 2 ? W / 2 : 0),
    cy: pad + R + tile.row * H,
    e: by.get(tile.id),
  }));
  const width = Math.max(...cells.map((c) => c.cx)) + W / 2 + pad;
  const height = Math.max(...cells.map((c) => c.cy)) + R + pad;
  const striped = [...new Set(COUNCIL_ELECTIONS.filter((e) => e.control.kind === "minority" || e.control.kind === "noc").map((e) => e.control.party))];

  const parties = ORDER.filter((p) => COUNCIL_ELECTIONS.some((e) => e.control.party === p && e.control.kind !== "disputed"));
  const collation = locale === "cy" ? "cy" : "en";
  const names = (list: CouncilElection[]) =>
    formatList(locale, list.map((e) => name(e.id)).sort((a, b) => a.localeCompare(b, collation)), { places: true });
  const disputed = COUNCIL_ELECTIONS.filter((e) => e.control.kind === "disputed");

  return (
    <figure className="grid gap-x-10 gap-y-6 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <div>
        <svg viewBox={`0 0 ${width.toFixed(0)} ${height.toFixed(0)}`} role="img" aria-label={t.mapLabel} className="block h-auto w-full">
          <defs>
            {striped.map((p) => (
              <Stripes key={p} party={p} />
            ))}
          </defs>
          {cells.map((c) => {
            const f = fill(c.e);
            const label = `${name(c.id)}: ${c.e ? t[c.e.control.kind === "majority" ? "majority" : c.e.control.kind === "disputed" ? "disputed" : "minority"] : ""}, ${c.e ? runner(locale, c.e.control.party) : ""}`;
            const hex = (
              <g className="control-hex">
                <title>{label}</title>
                <polygon points={hexPoints(c.cx, c.cy, R - 2.5)} fill={f.fill} stroke={f.stroke} strokeWidth={1.5} strokeDasharray={f.dash} />
                <text x={c.cx} y={c.cy + 4.5} textAnchor="middle" aria-hidden="true">
                  {c.code}
                </text>
              </g>
            );
            return linked.has(c.id) ? (
              <Link key={c.id} href={href(locale, `/${c.id}`)} aria-label={name(c.id)}>
                {hex}
              </Link>
            ) : (
              <g key={c.id}>{hex}</g>
            );
          })}
        </svg>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-meta text-ink-2">
          {(["majority", "minority", "disputed"] as const).map((k) => (
            <li key={k} className="inline-flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                {k === "minority" ? (
                  <defs>
                    <pattern id="stripes-key" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width="4" height="4" fill="var(--bg)" />
                      <rect width="2.3" height="4" fill="var(--ink-2)" />
                    </pattern>
                  </defs>
                ) : null}
                <polygon
                  points={hexPoints(7, 7, 6.2)}
                  fill={k === "majority" ? "var(--ink-2)" : k === "minority" ? "url(#stripes-key)" : "var(--map-none)"}
                  stroke={k === "disputed" ? "var(--ink-3)" : "var(--ink-2)"}
                  strokeDasharray={k === "disputed" ? "2 2" : undefined}
                />
              </svg>
              {t[k]}
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="text-small">
        <ul className="rows">
          {parties.map((p) => {
            const runs = COUNCIL_ELECTIONS.filter((e) => e.control.party === p && e.control.kind !== "disputed");
            const majority = runs.filter((e) => e.control.kind === "majority");
            const without = runs.filter((e) => e.control.kind !== "majority");
            const n = runs.length === 1 ? t.councilsOne : t.councilsMany.replace("{n}", formatNumber(locale, runs.length));
            return (
              <li key={p} className="py-2.5">
                <p className="flex items-center gap-2 font-semibold">
                  <span aria-hidden="true" className="inline-block size-3 shrink-0 rounded-[3px]" style={{ background: partyColour(p) }} />
                  {t.count.replace("{party}", runner(locale, p)).replace("{n}", n)}
                </p>
                <p className="mt-0.5 text-ink-2">
                  {majority.length ? t.withMajority.replace("{list}", names(majority)) : null}
                  {majority.length && without.length ? " " : null}
                  {without.length ? t.withoutMajority.replace("{list}", names(without)) : null}
                </p>
              </li>
            );
          })}
          {disputed.map((e) => (
            <li key={e.id} className="py-2.5 text-ink-2">
              {t.disputedLine
                .replace("{council}", name(e.id))
                .replace("{party}", locale === "cy" ? softMutate(runner(locale, e.control.party)) : runner(locale, e.control.party))}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-meta text-ink-3">
          <Rich
            text={t.source.replace("{date}", formatDate(locale, ELECTIONS_AS_OF))}
            links={{ e: href(locale, "/elections") }}
          />
        </p>
      </figcaption>
    </figure>
  );
}
