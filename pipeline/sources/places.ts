/**
 * Builds each council area's local figures from DataMapWales layers: the
 * small neighbourhoods in it (2021 Lower layer Super Output Areas, about
 * 1,600 people each) and the figures for each, with summaries for the council
 * area and for Wales worked out the same way so they can be compared.
 *
 * Copied from OpenSenedd (where the areas are Senedd constituencies) and
 * adapted: a neighbourhood's council comes from its official name, which
 * starts with the council area's name ("Cardiff 032A").
 */
import {
  boxOf,
  groupByCode,
  labelPoint,
  msoaNameOf,
  number,
  ringArea,
  settlement,
  svgPath,
  valuesByCode,
  type Box,
  type Feature,
  type Polygon,
  type Settlement,
} from "./datamap";

/** WIMD 2025 domains, in the order the Welsh Government lists them. */
export const WIMD_DOMAINS = [
  "income",
  "employment",
  "health",
  "education",
  "access_to_services",
  "housing",
  "community_safety",
  "physical_environment",
] as const;
export type WimdDomain = (typeof WIMD_DOMAINS)[number];

export interface PlaceLayers {
  lsoas: Feature[];
  wimd: Feature[];
  domains: Record<WimdDomain, Feature[]>;
  welsh: Feature[];
  ruc: Feature[];
  secondHomes: Feature[];
}

export interface Named {
  code: string;
  en: string;
  cy: string;
}

export interface PlaceLsoa extends Named {
  /** SVG path in the shared grid. */
  d: string;
  /** WIMD 2025 overall rank, 1 = most deprived of 1,917. */
  wimd: number | null;
  /** Percentage aged 3 and over able to speak Welsh, Census 2021. */
  welsh: number | null;
  set: Settlement | null;
  /**
   * Second homes per 1,000 homes on the council tax list (March 2023), for the
   * wider area (MSOA) the neighbourhood is in. "few" where the figure is
   * withheld because the numbers are very small; null where none is published.
   */
  second: number | "few" | null;
}

export interface PlaceSummary {
  lsoas: number;
  welsh: number | null;
  welshTop: (Named & { value: number }) | null;
  /** Neighbourhoods able to speak Welsh at 40% or more. */
  welshHigh: number;
  settlement: Record<Settlement, number>;
  /** Neighbourhoods among the 10% most deprived in Wales, and among the 10% least. */
  deprived10: number;
  least10: number;
  mostDeprived: (Named & { rank: number }) | null;
  leastDeprived: (Named & { rank: number }) | null;
  /** Median rank in each WIMD domain (959 is the middle of Wales). */
  domains: Record<WimdDomain, number | null>;
  /**
   * Second homes across the wider areas (MSOAs): the middle area's rate per
   * 1,000 homes (areas with very few counted as lowest), how many areas have
   * 50 or more per 1,000, and how many have no published figure.
   */
  secondHomes: {
    median: number;
    /** The middle area's figure was withheld because the numbers were very small; `median` is then 0. */
    medianFew?: boolean;
    /** Areas whose figure was withheld because the numbers were very small. */
    few?: number;
    areas: number;
    over50: number;
    missing: number;
  } | null;
}

export interface PlaceIndexEntry {
  slug: string;
  name: string;
  no: number;
  /** Outline for the map of Wales. */
  d: string;
  label: [number, number];
  box: Box;
  summary: PlaceSummary;
}

export interface Place {
  slug: string;
  name: string;
  no: number;
  box: Box;
  /** Detailed outline. */
  d: string;
  lsoas: PlaceLsoa[];
  summary: PlaceSummary;
}

export interface PlacesIndex {
  box: Box;
  councils: PlaceIndexEntry[];
  wales: PlaceSummary;
  /** Total neighbourhoods in Wales; ranks run from 1 to this. */
  ranked: number;
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const round1 = (n: number) => Math.round(n * 10) / 10;

interface Hood extends Named {
  polys: Polygon[];
  msoa: string;
  wimd: number | null;
  domains: Record<WimdDomain, number | null>;
  welsh: number | null;
  set: Settlement | null;
}

type Msoa = number | "few" | null;

/**
 * An MSOA name for matching across layers, which don't always name a council
 * the same way ("Isle of Anglesey 001" and "Anglesey 001").
 */
export function msoaKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(isle of|the)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function summarise(hoods: Hood[], msoas: Msoa[], ranked: number): PlaceSummary {
  const tenth = Math.round(ranked / 10);
  const welsh = hoods.filter((h) => h.welsh !== null);
  const ranked_ = hoods.filter((h) => h.wimd !== null).sort((a, b) => a.wimd! - b.wimd!);
  const named = (h: Hood): Named => ({ code: h.code, en: h.en, cy: h.cy });
  const top = [...welsh].sort((a, b) => b.welsh! - a.welsh!)[0];
  const known = msoas.filter((m) => m !== null).map((m) => (m === "few" ? 0 : m));
  const shMedian = median(known);
  // "Very few" sorts lowest; when the middle area (or both middle areas) is one, say so instead of showing 0.
  const fewCount = msoas.filter((m) => m === "few").length;
  // When at least half the areas are withheld, the middle figure is (or is next to) one of them.
  const medianFew = known.length > 0 && fewCount > 0 && fewCount * 2 >= known.length;
  return {
    lsoas: hoods.length,
    welsh: welsh.length ? round1(welsh.reduce((n, h) => n + h.welsh!, 0) / welsh.length) : null,
    welshTop: top ? { ...named(top), value: top.welsh! } : null,
    welshHigh: welsh.filter((h) => h.welsh! >= 40).length,
    settlement: {
      urban: hoods.filter((h) => h.set === "urban").length,
      town: hoods.filter((h) => h.set === "town").length,
      rural: hoods.filter((h) => h.set === "rural").length,
    },
    deprived10: ranked_.filter((h) => h.wimd! <= tenth).length,
    least10: ranked_.filter((h) => h.wimd! > ranked - tenth).length,
    mostDeprived: ranked_[0] ? { ...named(ranked_[0]), rank: ranked_[0].wimd! } : null,
    leastDeprived: ranked_.length ? { ...named(ranked_[ranked_.length - 1]), rank: ranked_[ranked_.length - 1].wimd! } : null,
    domains: Object.fromEntries(
      WIMD_DOMAINS.map((d) => [d, median(hoods.map((h) => h.domains[d]).filter((v): v is number => v !== null))]),
    ) as Record<WimdDomain, number | null>,
    secondHomes:
      shMedian !== null && known.length >= msoas.length / 2
        ? {
            median: round1(shMedian),
            ...(medianFew ? { medianFew: true } : {}),
            ...(fewCount ? { few: fewCount } : {}),
            areas: msoas.length,
            over50: known.filter((v) => v >= 50).length,
            missing: msoas.length - known.length,
          }
        : null,
  };
}

export interface BuildResult {
  index: PlacesIndex;
  places: Place[];
  problems: string[];
}

/**
 * @param councilOf maps a council area name as it starts an LSOA name ("Cardiff", "Isle of Anglesey") to a council ID.
 */
export function buildPlaces(layers: PlaceLayers, councilOf: (laName: string) => string | null): BuildResult {
  const problems: string[] = [];
  const wimd = valuesByCode(layers.wimd, "lsoa", (p) => number(p.rank));
  const domains = Object.fromEntries(WIMD_DOMAINS.map((d) => [d, valuesByCode(layers.domains[d], "lsoa", (p) => number(p.rank))])) as Record<
    WimdDomain,
    Map<string, number>
  >;
  const welsh = valuesByCode(layers.welsh, "lsoacode", (p) => number(p.percentage));
  const ruc = valuesByCode(layers.ruc, "lsoa21cd", (p) => settlement(String(p.ruc21nm ?? "")));
  const msoaRows = new Map<string, Msoa>();
  for (const f of layers.secondHomes) {
    const name = String(f.properties.msoa_name ?? "").trim();
    const raw = String(f.properties.number ?? "").trim();
    if (name) msoaRows.set(msoaKey(name), raw === "*" ? "few" : number(raw));
  }

  const lsoaShapes = groupByCode(
    layers.lsoas.filter((f) => String(f.properties.lsoa21cd ?? "").startsWith("W")),
    "lsoa21cd",
  );
  const ranked = wimd.size;
  const byArea = new Map<string, Hood[]>();
  const unknownAreas = new Set<string>();
  const all: Hood[] = [];
  for (const [code, { properties: p, polys }] of lsoaShapes) {
    const official = String(p.lsoa21nm ?? code);
    const hood: Hood = {
      code,
      en: String(p.lsoaalternativeenglish ?? "").trim() || official,
      cy: String(p.lsoaalternativewelsh ?? "").trim() || String(p.lsoa21nmw ?? "").trim() || official,
      polys,
      msoa: msoaNameOf(official),
      wimd: wimd.get(code) ?? null,
      domains: Object.fromEntries(WIMD_DOMAINS.map((d) => [d, domains[d].get(code) ?? null])) as Record<WimdDomain, number | null>,
      welsh: welsh.get(code) ?? null,
      set: ruc.get(code) ?? null,
    };
    all.push(hood);
    const laName = official.replace(/\s+\d{3}[A-Z]$/, "").trim();
    const key = councilOf(laName);
    if (!key) unknownAreas.add(laName);
    else {
      const list = byArea.get(key) ?? [];
      list.push(hood);
      byArea.set(key, list);
    }
  }
  for (const n of unknownAreas) problems.push(`council area not recognised: ${n}`);
  const areas = [...byArea.keys()].map((key) => ({
    key,
    name: key,
    no: 0,
    polys: byArea.get(key)!.flatMap((h) => h.polys),
  }));

  // Each wider area (MSOA) goes to the council area holding most of its neighbourhoods.
  const msoaHome = new Map<string, string>();
  {
    const tally = new Map<string, Map<string, number>>();
    for (const [key, hoods] of byArea)
      for (const h of hoods) {
        const t = tally.get(h.msoa) ?? new Map<string, number>();
        t.set(key, (t.get(key) ?? 0) + 1);
        tally.set(h.msoa, t);
      }
    for (const [m, t] of tally) msoaHome.set(m, [...t].sort((a, b) => b[1] - a[1])[0][0]);
  }
  const per1000 = (name: string): Msoa => msoaRows.get(msoaKey(name)) ?? null;

  const coverage = (label: string, n: number) => {
    if (n < all.length * 0.98) problems.push(`${label}: figures for only ${n} of ${all.length} neighbourhoods`);
  };
  coverage("deprivation", all.filter((h) => h.wimd !== null).length);
  coverage("Welsh language", all.filter((h) => h.welsh !== null).length);
  coverage("rural and urban", all.filter((h) => h.set !== null).length);
  const unmatched = [...msoaHome.keys()].filter((m) => !msoaRows.has(msoaKey(m)));
  if (unmatched.length > msoaHome.size * 0.05) problems.push(`second homes: no row for ${unmatched.length} of ${msoaHome.size} areas`);
  for (const d of WIMD_DOMAINS) coverage(`deprivation (${d})`, all.filter((h) => h.domains[d] !== null).length);

  const places: Place[] = [];
  const entries: PlaceIndexEntry[] = [];
  for (const a of areas) {
    const hoods = byArea.get(a.key)!;
    if (hoods.length < 25) problems.push(`${a.name}: only ${hoods.length} neighbourhoods`);
    // Small offshore islands (Flat Holm, Skomer) would shrink the map; the box leaves them out.
    const total = a.polys.reduce((n, p) => n + Math.abs(ringArea(p[0])), 0);
    const main = a.polys.filter((p) => Math.abs(ringArea(p[0])) >= total * 0.002);
    const box = boxOf(main);
    // About one and a half screen pixels on a wide screen: finer detail would only add weight.
    const tol = Math.max(10, (box.w * 10) / 1000);
    const mine = [...msoaHome].filter(([, k]) => k === a.key).map(([m]) => per1000(m));
    const summary = summarise(hoods, mine, ranked);
    places.push({
      slug: a.key,
      name: a.name,
      no: a.no,
      box,
      // No separate outline: the neighbourhoods make up the whole area.
      d: "",
      lsoas: hoods
        .map((h) => ({
          code: h.code,
          en: h.en,
          cy: h.cy,
          d: svgPath(h.polys, tol),
          wimd: h.wimd,
          welsh: h.welsh,
          set: h.set,
          second: per1000(h.msoa),
        }))
        .filter((h) => h.d),
      summary,
    });
    entries.push({ slug: a.key, name: a.name, no: a.no, d: svgPath(a.polys, 250), label: labelPoint(a.polys), box, summary });
  }
  const allPolys = areas.flatMap((a) => a.polys);
  return {
    index: {
      box: boxOf(allPolys),
      councils: entries.sort((x, y) => x.name.localeCompare(y.name, "cy")),
      wales: summarise(all, [...msoaHome.keys()].map(per1000), ranked),
      ranked,
    },
    places,
    problems,
  };
}
