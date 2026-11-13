/**
 * "Your area": maps and figures for each council area from DataMapWales (the
 * Welsh Government's map service). Copied from OpenSenedd and adapted.
 *
 * - Neighbourhoods: 2021 Lower layer Super Output Areas, each placed in its
 *   council area by its official name ("Cardiff 032A").
 * - Welsh Index of Multiple Deprivation 2025, overall and by domain.
 * - Census 2021: people aged 3 and over able to speak Welsh.
 * - Rural and urban classification 2021.
 * - Second homes on the council tax list per 1,000 homes, March 2023.
 *
 * These change rarely, so the layers are read again only once a month, or
 * with --force. The figures are checked (every neighbourhood placed, nearly
 * every one with figures) before they replace what the website shows.
 *
 *   pnpm pipeline places [--force]
 */
import { COUNCILS } from "../../data/curated/councils";
import { fetchText } from "../lib/http";
import type { Job, JobContext } from "../lib/job";
import { PartialFailure } from "../lib/job";
import { layerPage, wfsUrl, type Feature } from "../sources/datamap";
import { buildPlaces, WIMD_DOMAINS, type PlaceLayers } from "../sources/places";

const MONTH = 30 * 86_400_000;

/** A layer as [workspace, layer, properties]; no properties means the geometry is needed too. */
type LayerRef = readonly [string, string] | readonly [string, string, readonly string[]];

export const PLACE_LAYERS = {
  lsoas: ["geonode", "lsoa_2021_w_hwm"],
  wimd: ["geonode", "wimd2025_overall", ["lsoa", "rank"]],
  welsh: ["geonode", "welsh_language_2021", ["lsoacode", "percentage"]],
  ruc: ["geonode", "ruc_lsoa_2021", ["lsoa21cd", "ruc21nm"]],
  secondHomes: ["geonode", "second_homes_per_1000_ct_chargeable_homes_msoa_march_2023", ["msoa_code", "msoa_name", "number"]],
} as const satisfies Record<string, LayerRef>;

const domainLayer = (d: string): LayerRef => ["geonode", `wimd2025_${d}`, ["lsoa", "rank"]];

/**
 * DataMapWales's GeoServer sometimes answers "Feature type unknown" for a
 * layer that exists, and works on the next try, so each layer is tried a few times.
 */
async function layer(ctx: JobContext, [workspace, name, props]: LayerRef): Promise<Feature[]> {
  // The plain request first; then with the workspace named in the layer, then a page at a time,
  // since the map service has started refusing some whole-layer requests.
  const plain = wfsUrl(workspace, name, props ? [...props] : undefined);
  const prefixed = plain.replace(`typeNames=${name}`, `typeNames=${workspace}%3A${name}`);
  let last = "";
  // Geometry layers are too big to ask for whole: the map service refuses them. Page through those.
  const tries = props ? [plain, plain, prefixed, prefixed] : [];
  for (const [attempt, url] of tries.entries()) {
    const r = await fetchText(url, { fresh: true, timeoutMs: 300_000, accept: "application/json", retries: 1 });
    if (r.ok && r.text.startsWith("{")) {
      const features = (JSON.parse(r.text) as { features: Feature[] }).features;
      if (features.length) return features;
      last = "no features";
    } else last = r.ok ? r.text.match(/<ows:ExceptionText>([^<]*)/)?.[1] ?? "not GeoJSON" : r.error;
    ctx.log(`${name}: attempt ${attempt + 1} failed (${last})`);
    await new Promise((res) => setTimeout(res, (attempt + 1) * 3000));
  }
  // Page through, 250 features at a time, in the layer's own order.
  const all: Feature[] = [];
  const PAGE = 250;
  for (let start = 0; start < 50_000; start += PAGE) {
    const url = `${plain}&count=${PAGE}&startIndex=${start}`;
    const r = await fetchText(url, { fresh: true, timeoutMs: 180_000, accept: "application/json", retries: 3 });
    if (!r.ok || !r.text.startsWith("{")) {
      last = `paged from ${start}: ${r.ok ? r.text.replace(/\s+/g, " ").slice(0, 300) : r.error}`;
      break;
    }
    const features = (JSON.parse(r.text) as { features: Feature[] }).features;
    all.push(...features);
    if (features.length < PAGE) return all;
  }
  throw new Error(`${name}: ${last}`);
}

/** Council area names as they start the ONS's neighbourhood names. */
function councilForArea(name: string): string | null {
  if (name === "Isle of Anglesey") return "anglesey";
  return COUNCILS.find((c) => c.shortEn === name)?.id ?? null;
}

export interface PlacesMeta {
  updatedAt: string;
  sources: Record<string, string>;
}

export const placesJob: Job = {
  name: "places",
  description: "Council area maps and neighbourhood figures from DataMapWales",
  async run(ctx) {
    const had = await ctx.getState<PlacesMeta>("areas-meta");
    if (had && ctx.args.force !== true && Date.now() - Date.parse(had.updatedAt) < MONTH) {
      ctx.log(`read on ${had.updatedAt.slice(0, 10)}; next read after a month`);
      return;
    }
    const layers: PlaceLayers = {
      lsoas: await layer(ctx, PLACE_LAYERS.lsoas),
      wimd: await layer(ctx, PLACE_LAYERS.wimd),
      domains: {} as PlaceLayers["domains"],
      welsh: await layer(ctx, PLACE_LAYERS.welsh),
      ruc: await layer(ctx, PLACE_LAYERS.ruc),
      secondHomes: await layer(ctx, PLACE_LAYERS.secondHomes),
    };
    for (const d of WIMD_DOMAINS) layers.domains[d] = await layer(ctx, domainLayer(d));

    const { index, places, problems } = buildPlaces(layers, councilForArea);
    if (index.councils.length !== 22) problems.push(`expected 22 council areas, found ${index.councils.length}`);
    if (index.ranked !== 1917) problems.push(`expected 1,917 ranked neighbourhoods, found ${index.ranked}`);
    if (problems.length) throw new PartialFailure(`not saved: ${problems.join("; ")}`);

    for (const p of places) await ctx.setState(`area:${p.slug}`, p);
    await ctx.setState("areas", index);
    const sources = Object.fromEntries(
      [...Object.entries(PLACE_LAYERS).map(([k, [w, n]]) => [k, layerPage(w, n)]), ...WIMD_DOMAINS.map((d) => [`wimd_${d}`, layerPage("geonode", `wimd2025_${d}`)])],
    );
    await ctx.setState("areas-meta", { updatedAt: new Date().toISOString(), sources } satisfies PlacesMeta);
    ctx.stats.councils = places.length;
    ctx.stats.neighbourhoods = index.wales.lsoas;
    ctx.touched.add("reference");
  },
};
