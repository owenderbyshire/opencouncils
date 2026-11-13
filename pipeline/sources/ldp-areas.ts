/**
 * Allocated sites' boundaries from authorities' published map data (WFS as
 * GeoJSON in longitude and latitude), and checking whether a point falls
 * inside one. Used by pipeline/jobs/ldp-areas.ts.
 */

export type Ring = [number, number][];
export type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };

/** The map layers read, with what they allocate land for. */
export const AREA_LAYERS = [
  { authority: "powys", layer: "opendata:ldp_residential_allocations", use: "housing", url: "https://geo.powys.gov.uk/geoserver/opendata/ows" },
  { authority: "powys", layer: "opendata:ldp_employment_allocs", use: "employment", url: "https://geo.powys.gov.uk/geoserver/opendata/ows" },
  { authority: "powys", layer: "opendata:ldp_mixed_use_allocs", use: "mixed", url: "https://geo.powys.gov.uk/geoserver/opendata/ows" },
  { authority: "torfaen", layer: "geonode:torfaen_ldp_employment", use: "employment", url: "https://datamap.gov.wales/geoserver/ows" },
] as const;

export function wfsUrl(base: string, layer: string): string {
  const q = new URLSearchParams({ service: "WFS", version: "2.0.0", request: "GetFeature", typeNames: layer, outputFormat: "application/json", srsName: "EPSG:4326" });
  return `${base}?${q}`;
}

/** Rounds coordinates to about a metre, which is plenty and keeps rows small. */
export function roundGeometry(g: Geometry): Geometry {
  const r = (ring: Ring): Ring => ring.map(([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]);
  return g.type === "Polygon" ? { type: "Polygon", coordinates: g.coordinates.map(r) } : { type: "MultiPolygon", coordinates: g.coordinates.map((p) => p.map(r)) };
}

export function bbox(g: Geometry): [number, number, number, number] {
  let a = Infinity,
    b = Infinity,
    c = -Infinity,
    d = -Infinity;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const p of polys)
    for (const ring of p)
      for (const [x, y] of ring) {
        a = Math.min(a, x);
        b = Math.min(b, y);
        c = Math.max(c, x);
        d = Math.max(d, y);
      }
  return [a, b, c, d];
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The point is inside the polygon's outer ring and outside its holes. */
export function contains(g: Geometry, lng: number, lat: number): boolean {
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  return polys.some(([outer, ...holes]) => !!outer && inRing(lng, lat, outer) && !holes.some((h) => inRing(lng, lat, h)));
}

/** The site's reference and name from whatever the layer calls them, most specific field first. */
export function siteLabel(props: Record<string, unknown>): { ref: string | null; name: string | null } {
  const value = (k: string) => {
    const hit = Object.entries(props).find(([key]) => key.toLowerCase() === k);
    const v = hit?.[1];
    return (typeof v === "string" || typeof v === "number") && String(v).trim() ? String(v).trim() : null;
  };
  const first = (keys: string[]) => keys.map(value).find((v) => v !== null) ?? null;
  return {
    ref: first(["ref_no", "site_ref", "ldp_ref", "ldprepno", "reference", "ref", "ldp_policy", "policy", "csref"]),
    name: first(["site_name", "name", "address", "location", "label", "description", "title"]),
  };
}
