/**
 * Every UK council OpenCouncils knows about, and the ones it holds records for.
 *
 * The list of councils comes from data/curated/register.json (built from
 * mySociety's UK local authority register by scripts/build-register.mjs).
 * Where each council keeps its committee records comes from
 * data/curated/platforms.json, written from the platform census
 * (`pnpm pipeline census`, then `node scripts/export-platforms.mjs`).
 * The 22 Welsh councils keep the addresses already checked by opencouncil.wales.
 *
 * A council is fetched by the pipeline and shown with full pages once it is
 * `active` and its system has a source. Every other current council still has
 * an entry in the register pages.
 *
 * Phases
 *   1  Cardiff pilot (inherited from the Welsh site)
 *   2  Councils whose ModernGov data service answered
 *   3  ModernGov councils whose addresses are still to be confirmed
 *   4  Councils on other systems
 */
import register from "./register.json";
import platforms from "./platforms.json";

export type Nation = "England" | "Scotland" | "Wales" | "Northern Ireland";
export type CouncilKind = "county" | "district" | "metropolitan" | "london-borough" | "unitary" | "city-corporation" | "combined";

export interface RegisterEntry {
  id: string;
  code: string | null;
  name: string;
  short: string;
  nation: Nation;
  region: string | null;
  kind: CouncilKind;
  typeName: string;
  gss: string | null;
  startDate: string | null;
  endDate: string | null;
  replacedBy: string[];
  county: string | null;
  combinedAuthority: string | null;
  population: number | null;
  lat: number | null;
  lng: number | null;
  govUkSlug: string | null;
  /** The council's number on WhatDoTheyKnow, mySociety's freedom of information site. */
  wdtkId: number | null;
  /** The council's id in Open Council Data UK's files. */
  ocdId: string | null;
  current: boolean;
  shadow?: boolean;
  status?: string;
  reorganisation?: string;
  replaces?: string[];
}

export interface PlatformEntry {
  platform: "moderngov" | "cmis" | "other" | "unknown";
  base: string | null;
  website: string | null;
  feedOk: boolean;
  checked: string;
}

export interface CouncilConfig {
  id: string;
  nameEn: string;
  nameCy: string;
  /** How the council is named in running text and lists. */
  shortEn: string;
  shortCy: string;
  website: string;
  moderngovBase: string | null;
  /** Query parameter that switches the council's ModernGov pages to Welsh. */
  welshQuery: string | null;
  /** A separate ModernGov site for Welsh pages, where the council runs one (Powys). */
  welshBase?: string;
  phase: 1 | 2 | 3 | 4;
  active: boolean;
  /** Where its records come from: ModernGov's web service, or the Vale of Glamorgan's own pages (pipeline/sources/vale.ts). */
  system: "moderngov" | "vale" | "none";
  /** The council's own page of meetings, agendas and minutes. */
  recordsUrl: string | null;
  nation: Nation;
  kind: CouncilKind;
  typeName: string;
  gss: string | null;
  population: number | null;
}

export const REGISTER = register.councils as RegisterEntry[];
const PLATFORMS = platforms.councils as Record<string, PlatformEntry>;
/**
 * Safeguard: a ModernGov address the census gave to more than one council is
 * not trusted (a district once picked up its county's site), so none of those
 * councils is fetched until the census tells them apart.
 */
const SHARED_BASES = (() => {
  const n = new Map<string, number>();
  for (const p of Object.values(PLATFORMS)) if (p.base) n.set(p.base, (n.get(p.base) ?? 0) + 1);
  return new Set([...n].filter(([, k]) => k > 1).map(([b]) => b));
})();

/** Councils in place today, from the four nations: the ones the site lists. */
export const CURRENT_COUNCILS = REGISTER.filter((c) => c.current && c.kind !== "combined");
/** Councils being set up by reorganisation (shadow authorities). */
export const SHADOW_COUNCILS = REGISTER.filter((c) => c.shadow);
/** Combined and strategic authorities: held for phase two, not shown yet. */
export const COMBINED_AUTHORITIES = REGISTER.filter((c) => c.current && c.kind === "combined");

export function registerEntry(id: string): RegisterEntry | undefined {
  return REGISTER.find((c) => c.id === id);
}

/**
 * Councils outside Wales switched on for full pages. Kept short while the
 * pipeline is proven at UK scale; the census fills platforms.json for all.
 */
const ACTIVE_IDS = new Set<string>(platforms.active as string[]);

type Row = [
  id: string,
  nameEn: string,
  nameCy: string,
  shortEn: string,
  shortCy: string,
  website: string,
  moderngovBase: string | null,
  phase: 1 | 2 | 3 | 4,
  extra?: Partial<CouncilConfig>,
];

const ROWS: Row[] = [
  ["cardiff", "Cardiff Council", "Cyngor Caerdydd", "Cardiff", "Caerdydd", "https://www.cardiff.gov.uk", "https://cardiff.moderngov.co.uk", 1],

  ["swansea", "Swansea Council", "Cyngor Abertawe", "Swansea", "Abertawe", "https://www.swansea.gov.uk", "https://democracy.swansea.gov.uk", 2],
  ["newport", "Newport City Council", "Cyngor Dinas Casnewydd", "Newport", "Casnewydd", "https://www.newport.gov.uk", "https://democracy.newport.gov.uk", 2],
  ["rhondda-cynon-taf", "Rhondda Cynon Taf County Borough Council", "Cyngor Bwrdeistref Sirol Rhondda Cynon Taf", "Rhondda Cynon Taf", "Rhondda Cynon Taf", "https://www.rctcbc.gov.uk", "https://rctcbc.moderngov.co.uk", 2],
  ["bridgend", "Bridgend County Borough Council", "Cyngor Bwrdeistref Sirol Pen-y-bont ar Ogwr", "Bridgend", "Pen-y-bont ar Ogwr", "https://www.bridgend.gov.uk", "https://democratic.bridgend.gov.uk", 2],
  ["torfaen", "Torfaen County Borough Council", "Cyngor Bwrdeistref Sirol Torfaen", "Torfaen", "Torfaen", "https://www.torfaen.gov.uk", "https://torfaen.moderngov.co.uk", 2],
  ["monmouthshire", "Monmouthshire County Council", "Cyngor Sir Fynwy", "Monmouthshire", "Sir Fynwy", "https://www.monmouthshire.gov.uk", "https://democracy.monmouthshire.gov.uk", 2],
  ["blaenau-gwent", "Blaenau Gwent County Borough Council", "Cyngor Bwrdeistref Sirol Blaenau Gwent", "Blaenau Gwent", "Blaenau Gwent", "https://www.blaenau-gwent.gov.uk", "https://democracy.blaenau-gwent.gov.uk", 2],
  ["merthyr-tydfil", "Merthyr Tydfil County Borough Council", "Cyngor Bwrdeistref Sirol Merthyr Tudful", "Merthyr Tydfil", "Merthyr Tudful", "https://www.merthyr.gov.uk", "https://democracy.merthyr.gov.uk", 2],
  ["neath-port-talbot", "Neath Port Talbot Council", "Cyngor Castell-nedd Port Talbot", "Neath Port Talbot", "Castell-nedd Port Talbot", "https://www.npt.gov.uk", "https://democracy.npt.gov.uk", 2],
  ["pembrokeshire", "Pembrokeshire County Council", "Cyngor Sir Penfro", "Pembrokeshire", "Sir Benfro", "https://www.pembrokeshire.gov.uk", "https://mgenglish.pembrokeshire.gov.uk", 2],
  ["ceredigion", "Ceredigion County Council", "Cyngor Sir Ceredigion", "Ceredigion", "Ceredigion", "https://www.ceredigion.gov.uk", "https://council.ceredigion.gov.uk", 2],
  ["powys", "Powys County Council", "Cyngor Sir Powys", "Powys", "Powys", "https://www.powys.gov.uk", "https://powys.moderngov.co.uk", 2, { welshQuery: null, welshBase: "https://powysw.moderngov.co.uk" }],
  ["gwynedd", "Gwynedd Council", "Cyngor Gwynedd", "Gwynedd", "Gwynedd", "https://www.gwynedd.llyw.cymru", "https://democracy.gwynedd.llyw.cymru", 2],

  ["carmarthenshire", "Carmarthenshire County Council", "Cyngor Sir Gâr", "Carmarthenshire", "Sir Gâr", "https://www.carmarthenshire.gov.wales", "https://democracy.carmarthenshire.gov.wales", 3],
  ["anglesey", "Isle of Anglesey County Council", "Cyngor Sir Ynys Môn", "Anglesey", "Ynys Môn", "https://www.anglesey.gov.wales", "https://democracy.anglesey.gov.wales", 3],
  ["caerphilly", "Caerphilly County Borough Council", "Cyngor Bwrdeistref Sirol Caerffili", "Caerphilly", "Caerffili", "https://www.caerphilly.gov.uk", "https://democracy.caerphilly.gov.uk", 3],
  // Conwy runs separate English and Welsh ModernGov sites; only the English one is confirmed.
  ["conwy", "Conwy County Borough Council", "Cyngor Bwrdeistref Sirol Conwy", "Conwy", "Conwy", "https://www.conwy.gov.uk", "https://modgovpub-eng.secure.conwy.gov.uk", 3, { welshQuery: null }],
  ["denbighshire", "Denbighshire County Council", "Cyngor Sir Ddinbych", "Denbighshire", "Sir Ddinbych", "https://www.denbighshire.gov.uk", "https://moderngov.denbighshire.gov.uk", 3],
  ["flintshire", "Flintshire County Council", "Cyngor Sir y Fflint", "Flintshire", "Sir y Fflint", "https://www.flintshire.gov.uk", "https://committeemeetings.flintshire.gov.uk", 3],
  ["wrexham", "Wrexham County Borough Council", "Cyngor Bwrdeistref Sirol Wrecsam", "Wrexham", "Wrecsam", "https://www.wrexham.gov.uk", "https://moderngov.wrexham.gov.uk", 3],

  // Runs its own committee system, not ModernGov: needs its own source.
  ["vale-of-glamorgan", "Vale of Glamorgan Council", "Cyngor Bro Morgannwg", "Vale of Glamorgan", "Bro Morgannwg", "https://www.valeofglamorgan.gov.uk", null, 4, {
    system: "vale",
    active: true,
    recordsUrl: "https://www.valeofglamorgan.gov.uk/en/our_council/Council-Structure/minutes,_agendas_and_reports/minutes,_agendas_and_reports.aspx",
  }],
];

const WELSH = new Map(
  ROWS.map(([id, nameEn, nameCy, shortEn, shortCy, website, moderngovBase, phase, extra]) => [
    id,
    {
      nameEn, nameCy, shortEn, shortCy, website, moderngovBase,
      welshQuery: moderngovBase ? "LLL=1" : null,
      phase,
      active: Boolean(moderngovBase),
      system: (moderngovBase ? "moderngov" : "none") as CouncilConfig["system"],
      recordsUrl: moderngovBase,
      ...extra,
    },
  ]),
);

export const COUNCILS: CouncilConfig[] = CURRENT_COUNCILS.map((r) => {
  const base = {
    id: r.id,
    nation: r.nation,
    kind: r.kind,
    typeName: r.typeName,
    gss: r.gss,
    population: r.population,
  };
  const welsh = WELSH.get(r.id);
  if (welsh) return { ...base, ...welsh };
  const p = PLATFORMS[r.id];
  const mg = p?.platform === "moderngov" && p.feedOk && p.base && !SHARED_BASES.has(p.base) ? p.base : null;
  return {
    ...base,
    nameEn: r.name,
    nameCy: r.name,
    shortEn: r.short,
    shortCy: r.short,
    website: p?.website ?? "",
    moderngovBase: mg,
    welshQuery: null,
    phase: mg ? 2 : p?.platform === "moderngov" ? 3 : 4,
    // Switched on council by council once the census has confirmed the feed (ACTIVE_IDS).
    active: Boolean(mg) && ACTIVE_IDS.has(r.id),
    system: mg ? "moderngov" : "none",
    recordsUrl: p?.base && !SHARED_BASES.has(p.base) ? p.base : null,
  };
});

/** Active ModernGov councils: the ones the ModernGov jobs fetch. */
export const ACTIVE_COUNCILS = COUNCILS.filter((c) => c.active && c.moderngovBase);

/** Every council whose records OpenCouncils holds, whatever system they come from. */
export const RECORD_COUNCILS = COUNCILS.filter((c) => c.active && c.system !== "none");

export function councilConfig(id: string): CouncilConfig | undefined {
  return COUNCILS.find((c) => c.id === id);
}
