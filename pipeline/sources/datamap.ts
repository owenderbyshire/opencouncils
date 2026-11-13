/**
 * DataMapWales (datamap.gov.wales), the Welsh Government's map data service.
 * Layers are read through its GeoServer WFS as GeoJSON in British National
 * Grid (EPSG:27700), which is already flat and in metres, so the website can
 * draw it as SVG without any projection.
 *
 * This module holds the pure parts: geometry (centroids, point in polygon,
 * simplification, SVG paths) and turning layer rows into per-neighbourhood
 * figures. The job in pipeline/jobs/places.ts does the fetching.
 */

export const DATAMAP_WFS = "https://datamap.gov.wales/geoserver";

/** A GeoServer WFS GetFeature request for a whole layer as GeoJSON. */
export function wfsUrl(workspace: string, layer: string, properties?: string[]): string {
  const p = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    outputFormat: "application/json",
    typeNames: layer,
  });
  if (properties) p.set("propertyName", properties.join(","));
  return `${DATAMAP_WFS}/${workspace}/ows?${p}`;
}

/** The public page for a layer, for source links. */
export const layerPage = (workspace: string, layer: string) => `https://datamap.gov.wales/layers/${workspace}:${layer}`;

export type Ring = Array<[number, number]>;
export type Polygon = Ring[]; // outer ring, then holes
export interface Feature {
  properties: Record<string, unknown>;
  geometry: { type: "Polygon"; coordinates: Polygon } | { type: "MultiPolygon"; coordinates: Polygon[] } | null;
}

export function polygonsOf(f: Feature): Polygon[] {
  if (!f.geometry) return [];
  return f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
}

/** Signed area of a ring (shoelace), square metres. */
export function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return a / 2;
}

/** Area-weighted centroid of a ring. */
export function ringCentroid(r: Ring): [number, number] {
  let a = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    a += f;
    x += (r[j][0] + r[i][0]) * f;
    y += (r[j][1] + r[i][1]) * f;
  }
  if (a === 0) return r[0];
  return [x / (3 * a), y / (3 * a)];
}

function inRing(pt: [number, number], r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i];
    const [xj, yj] = r[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inPolygons(pt: [number, number], polys: Polygon[]): boolean {
  return polys.some((p) => inRing(pt, p[0]) && !p.slice(1).some((h) => inRing(pt, h)));
}

/** The largest outer ring among a set of polygons. */
export function largestRing(polys: Polygon[]): Ring {
  let best: Ring = polys[0][0];
  let size = -1;
  for (const p of polys) {
    const a = Math.abs(ringArea(p[0]));
    if (a > size) {
      size = a;
      best = p[0];
    }
  }
  return best;
}

/**
 * Which area a neighbourhood falls in: the one containing the centroid of its
 * largest part, or, if the centroid lies outside every area (a crescent-shaped
 * neighbourhood, or one on the coast), the area containing most of its corners.
 */
export function assignArea<K>(polys: Polygon[], areas: Array<{ key: K; polys: Polygon[] }>): K | null {
  const ring = largestRing(polys);
  const c = ringCentroid(ring);
  const hit = areas.find((a) => inPolygons(c, a.polys));
  if (hit) return hit.key;
  const votes = new Map<K, number>();
  const step = Math.max(1, Math.floor(ring.length / 50));
  for (let i = 0; i < ring.length; i += step) {
    const a = areas.find((x) => inPolygons(ring[i], x.polys));
    if (a) votes.set(a.key, (votes.get(a.key) ?? 0) + 1);
  }
  let best: K | null = null;
  let n = 0;
  for (const [k, v] of votes)
    if (v > n) {
      best = k;
      n = v;
    }
  return best;
}

/** Douglas-Peucker simplification of a closed ring. */
export function simplifyRing(r: Ring, tolerance: number): Ring {
  if (r.length <= 4) return r;
  const keep = new Uint8Array(r.length);
  keep[0] = 1;
  keep[r.length - 1] = 1;
  // Split a closed ring at its farthest point from the start so both halves simplify well.
  let far = 0;
  let farD = -1;
  for (let i = 1; i < r.length - 1; i++) {
    const d = (r[i][0] - r[0][0]) ** 2 + (r[i][1] - r[0][1]) ** 2;
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  keep[far] = 1;
  const tol2 = tolerance * tolerance;
  const stack: Array<[number, number]> = [
    [0, far],
    [far, r.length - 1],
  ];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = r[a];
    const [bx, by] = r[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let idx = -1;
    let max = tol2;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = r[i];
      let d: number;
      if (len2 === 0) d = (px - ax) ** 2 + (py - ay) ** 2;
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      }
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (idx >= 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return r.filter((_, i) => keep[i]);
}

/*
 * Drawing coordinates: tens of metres from a fixed origin west and north of
 * Wales, with y pointing down, so every map on the site shares one grid.
 */
const ORIGIN_E = 140_000;
const ORIGIN_N = 400_000;
export const toGrid = ([e, n]: [number, number]): [number, number] => [Math.round((e - ORIGIN_E) / 10), Math.round((ORIGIN_N - n) / 10)];

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function boxOf(polys: Polygon[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polys)
    for (const pt of p[0]) {
      const [x, y] = toGrid(pt);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * An SVG path in the shared grid, simplified to `tolerance` metres. Parts
 * smaller than a few pixels at that scale (tiny islands, slivers) are dropped,
 * except that the largest part is always kept.
 */
export function svgPath(polys: Polygon[], tolerance: number): string {
  const minArea = (tolerance * 3) ** 2;
  const big = largestRing(polys);
  let d = "";
  for (const p of polys)
    for (const ring of p) {
      if (ring !== big && Math.abs(ringArea(ring)) < minArea) continue;
      const pts = simplifyRing(ring, tolerance).map(toGrid);
      const clean: Array<[number, number]> = [];
      for (const pt of pts) {
        const last = clean[clean.length - 1];
        if (!last || last[0] !== pt[0] || last[1] !== pt[1]) clean.push(pt);
      }
      if (clean.length > 1 && clean[0][0] === clean[clean.length - 1][0] && clean[0][1] === clean[clean.length - 1][1]) clean.pop();
      if (clean.length < 3) continue;
      d += `M${clean[0][0]} ${clean[0][1]}`;
      for (let i = 1; i < clean.length; i++) d += `l${clean[i][0] - clean[i - 1][0]} ${clean[i][1] - clean[i - 1][1]}`;
      d += "z";
    }
  return d;
}

/** A point to place a label: the centroid of the largest part, in the grid. */
export const labelPoint = (polys: Polygon[]) => toGrid(ringCentroid(largestRing(polys)));

/** Groups features (some layers split a neighbourhood into several features) by a code. */
export function groupByCode(features: Feature[], field: string): Map<string, { properties: Record<string, unknown>; polys: Polygon[] }> {
  const out = new Map<string, { properties: Record<string, unknown>; polys: Polygon[] }>();
  for (const f of features) {
    const code = String(f.properties[field] ?? "").trim();
    if (!code) continue;
    const had = out.get(code);
    if (had) had.polys.push(...polygonsOf(f));
    else out.set(code, { properties: f.properties, polys: polygonsOf(f) });
  }
  return out;
}

/** A layer's rows as code → value, with codes trimmed and "..", "" or "-" (withheld or missing) dropped. */
export function valuesByCode<T>(features: Feature[], codeField: string, read: (p: Record<string, unknown>) => T | null): Map<string, T> {
  const out = new Map<string, T>();
  for (const f of features) {
    const code = String(f.properties[codeField] ?? "").trim();
    if (!code) continue;
    const v = read(f.properties);
    if (v !== null) out.set(code, v);
  }
  return out;
}

export function number(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v ?? "").replace(/,/g, "").trim();
  if (!s || s === ".." || s === "-" || s === "*") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** The 2021 rural-urban classification in three groups. */
export type Settlement = "urban" | "town" | "rural";
export function settlement(ruc21nm: string): Settlement | null {
  if (/^urban/i.test(ruc21nm)) return "urban";
  if (/^larger rural/i.test(ruc21nm)) return "town";
  if (/^smaller rural/i.test(ruc21nm)) return "rural";
  return null;
}

/** "Isle of Anglesey 001A" → "Isle of Anglesey 001": the middle-layer area a neighbourhood sits in. */
export const msoaNameOf = (lsoaName: string) => lsoaName.replace(/[A-Z]$/, "").trim();
