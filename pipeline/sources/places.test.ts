import { describe, expect, it } from "vitest";
import { assignArea, inPolygons, msoaNameOf, number, settlement, simplifyRing, svgPath, wfsUrl, type Feature, type Polygon } from "./datamap";
import { buildPlaces, WIMD_DOMAINS } from "./places";

const square = (x: number, y: number, s: number): Polygon => [
  [
    [x, y],
    [x + s, y],
    [x + s, y + s],
    [x, y + s],
    [x, y],
  ],
];

describe("map geometry", () => {
  it("finds points inside polygons, respecting holes", () => {
    const withHole: Polygon = [...square(0, 0, 10), square(4, 4, 2)[0]];
    expect(inPolygons([1, 1], [withHole])).toBe(true);
    expect(inPolygons([5, 5], [withHole])).toBe(false);
    expect(inPolygons([11, 1], [withHole])).toBe(false);
  });

  it("places a crescent-shaped area by its corners when its middle is outside", () => {
    // A U shape whose centroid falls in its gap.
    const u: Polygon = [
      [
        [0, 0],
        [30, 0],
        [30, 30],
        [20, 30],
        [20, 10],
        [10, 10],
        [10, 30],
        [0, 30],
        [0, 0],
      ],
    ];
    // Its middle (15, 13.6) is in neither area; more of its corners are in "b".
    const areas = [
      { key: "a", polys: [square(-5, -5, 40).map((r) => r.map(([x, y]) => [x, y < 0 ? -5 : 9] as [number, number]))] },
      { key: "b", polys: [square(-5, 20, 40)] },
    ];
    expect(assignArea([u], areas)).toBe("b");
  });

  it("simplifies a ring but keeps its shape", () => {
    const ring: Array<[number, number]> = [];
    for (let i = 0; i <= 100; i++) ring.push([i, i % 2 ? 0.1 : 0]);
    ring.push([100, 50], [0, 50], [0, 0]);
    const s = simplifyRing(ring, 1);
    expect(s.length).toBeLessThan(10);
    expect(s).toContainEqual([100, 50]);
  });

  it("draws a path in the shared grid", () => {
    expect(svgPath([square(140_000, 399_000, 1000)], 10)).toBe("M0 100l100 0l0 -100l-100 0z");
  });

  it("reads published figures", () => {
    expect(number("..")).toBeNull();
    expect(number("*")).toBeNull();
    expect(number("1,234")).toBe(1234);
    expect(settlement("Smaller rural: Further from a major town or city")).toBe("rural");
    expect(settlement("Larger rural: Nearer to a major town or city")).toBe("town");
    expect(settlement("Urban: Nearer to a major town or city")).toBe("urban");
    expect(msoaNameOf("Isle of Anglesey 001A")).toBe("Isle of Anglesey 001");
    expect(wfsUrl("geonode", "wimd2025_overall", ["lsoa", "rank"])).toBe(
      "https://datamap.gov.wales/geoserver/geonode/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application%2Fjson&typeNames=wimd2025_overall&propertyName=lsoa%2Crank",
    );
  });
});

describe("council area figures", () => {
  // Two council areas, each with ten neighbourhoods in a row, named the way the ONS names them.
  const feature = (properties: Record<string, unknown>, poly?: Polygon): Feature => ({
    properties,
    geometry: poly ? { type: "Polygon", coordinates: poly } : null,
  });
  const codes = Array.from({ length: 20 }, (_, i) => `W010000${String(i).padStart(2, "0")}`);
  const nameOf = (i: number) => `${i < 10 ? "West" : "East"} ${String(Math.floor((i % 10) / 5)).padStart(3, "0")}${"ABCDE"[i % 5]}`;
  const lsoas = codes.map((code, i) =>
    feature({ lsoa21cd: code, lsoa21nm: nameOf(i), lsoaalternativeenglish: `Hood ${i}` }, square(200_000 + i * 1000, 300_000, 1000)),
  );
  const ranks = (f: (i: number) => number) => codes.map((code, i) => feature({ lsoa: code, rank: f(i) }));
  const layers = {
    lsoas,
    wimd: ranks((i) => i + 1),
    domains: Object.fromEntries(WIMD_DOMAINS.map((d) => [d, ranks((i) => 20 - i)])) as never,
    welsh: codes.map((code, i) => feature({ lsoacode: code, percentage: i < 10 ? 50 : 10 })),
    ruc: codes.map((code, i) => feature({ lsoa21cd: code, ruc21nm: i % 2 ? "Urban: x" : "Smaller rural: y" })),
    secondHomes: ["West 000", "West 001", "East 000", "East 001"].map((n, i) => feature({ msoa_name: n, number: ["40", "*", "..", "60"][i] })),
  };
  const r = buildPlaces(layers, (n) => (n === "West" || n === "East" ? n.toLowerCase() : null));

  it("places every neighbourhood in its council area by name and summarises each", () => {
    const west = r.places.find((p) => p.slug === "west")!;
    expect(west.lsoas).toHaveLength(10);
    expect(west.summary.welsh).toBe(50);
    expect(west.summary.settlement).toEqual({ urban: 5, town: 0, rural: 5 });
    // 20 neighbourhoods ranked, so the 10% most deprived are ranks 1 and 2.
    expect(west.summary.deprived10).toBe(2);
    expect(west.summary.mostDeprived?.en).toBe("Hood 0");
    expect(west.summary.secondHomes).toEqual({ median: 20, medianFew: true, few: 1, areas: 2, over50: 0, missing: 0 });
    const east = r.places.find((p) => p.slug === "east")!;
    expect(east.lsoas).toHaveLength(10);
    expect(east.summary.secondHomes).toEqual({ median: 60, areas: 2, over50: 1, missing: 1 });
    expect(r.index.councils).toHaveLength(2);
    expect(r.index.wales.lsoas).toBe(20);
    expect(r.problems).toEqual([`west: only 10 neighbourhoods`, `east: only 10 neighbourhoods`]);
  });

  it("reports names it can't place", () => {
    const odd = buildPlaces({ ...layers, lsoas: [...lsoas, feature({ lsoa21cd: "W01999999", lsoa21nm: "Nowhere 001A" }, square(0, 0, 10))] }, (n) =>
      n === "West" || n === "East" ? n.toLowerCase() : null,
    );
    expect(odd.problems).toContain("council area not recognised: Nowhere");
  });

  it("matches MSOA names written differently", async () => {
    const { msoaKey } = await import("./places");
    expect(msoaKey("Isle of Anglesey 001")).toBe(msoaKey("Anglesey 001"));
    expect(msoaKey("Vale of Glamorgan 004")).toBe("vale of glamorgan 004");
  });
});
