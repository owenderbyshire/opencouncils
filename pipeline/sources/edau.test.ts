import http from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MEASURES } from "../../data/curated/performance";
import { series } from "../jobs/performance";
import { bandD, tidy } from "./council-data";
import { edauFeed, edauSlice, labelRowFromEdau, metaFromEdau, rowsForSlice, sliceKey, type EdauRow } from "./edau";
import { csvRecords } from "./statswales";

type Page = { rows: EdauRow[]; slice: string; about: Parameters<typeof metaFromEdau>[0] };
const fixtures = JSON.parse(readFileSync(path.join(import.meta.dirname, "fixtures/edau-feed.json"), "utf8")) as { temporaryAccommodation: Page; bandD: Page };
const ta = fixtures.temporaryAccommodation;
const measure = MEASURES.find((m) => m.key === "temporary-accommodation")!;

/** The same rows as StatsWales gave statsWalesSome() in labels mode, columns in the publisher's order. */
const STATSWALES_CSV = [
  "Area,Period,Accommodation type,Data description,Data values,Notes",
  "Cardiff,31 July 2026,Total,Total number of homeless people temporarily accommodated,1532,",
  "Cardiff,30 June 2026,Total,Total number of homeless people temporarily accommodated,1498,",
  "Swansea,31 July 2026,Total,Total number of homeless people temporarily accommodated,640,Estimated",
  "Wales,31 July 2026,Total,Total number of homeless people temporarily accommodated,11904,",
].join("\n");

describe("StatsWales through Edau", () => {
  it("is used only when both variables are set", () => {
    expect(edauFeed({})).toBeNull();
    expect(edauFeed({ EDAU_FEED_KEY: "edau_product_x" })).toBeNull();
    expect(edauFeed({ EDAU_FEED_URL: "https://edau.cymru/", EDAU_FEED_KEY: "edau_product_x" })).toEqual({ base: "https://edau.cymru/api/v1/feed", key: "edau_product_x" });
  });

  it("names each read the way Edau stores it", () => {
    const wanted = MEASURES.filter((x) => x.dataset === measure.dataset).flatMap((x) => [...x.labels, ...(x.numerator ?? []), ...(x.plus ?? [])]);
    expect(sliceKey(wanted)).toBe(ta.slice);
    expect(sliceKey("whole")).toBe("whole");
    expect(sliceKey(["Total", " total ", "Café"])).toBe('labels:["cafe","total"]');
  });

  it("turns Edau's rows back into the labels-only rows StatsWales gave, in the publisher's column order", () => {
    const rows = rowsForSlice(ta.rows, ta.slice);
    expect(rows).toEqual(csvRecords(STATSWALES_CSV));
    expect(Object.keys(rows[0])).toEqual(["Area", "Period", "Accommodation type", "Data description", "Data values", "Notes"]);
    expect(labelRowFromEdau({ A: "x", A_reference: "1", A_sort: "2", "Data values": 3.5, Notes: null })).toEqual({ A: "x", "Data values": "3.5", Notes: "" });
  });

  it("gives the same figures, periods and councils as reading StatsWales directly", () => {
    const fromEdau = series(tidy(rowsForSlice(ta.rows, ta.slice)), measure.labels, "count", 25);
    const direct = series(tidy(csvRecords(STATSWALES_CSV)), measure.labels, "count", 25);
    expect(fromEdau).toEqual(direct);
    expect(Object.fromEntries(fromEdau)).toEqual({
      cardiff: [{ period: "2026-06-30", value: 1498 }, { period: "2026-07-31", value: 1532 }],
      swansea: [{ period: "2026-07-31", value: 640 }],
      wales: [{ period: "2026-07-31", value: 11904 }],
    });
  });

  it("reads a whole dataset, keeping the councils' own total", () => {
    const b = bandD(tidy(rowsForSlice(fixtures.bandD.rows, "whole")));
    expect(b.get("cardiff")).toEqual([{ year: "2026-27", total: 2103.41, county: 1755.05, community: 0, police: 348.36 }]);
    expect(b.get("wales-councils")?.[0].total).toBe(2214.87);
  });

  it("takes the dataset's titles from Edau", () => {
    expect(metaFromEdau(ta.about)).toMatchObject({ titleEn: "Homeless people in temporary accommodation by local authority", coverageEnd: "2026-07-31", archived: false });
  });
});

describe("reading Edau's feed", () => {
  let server: http.Server;
  let base = "";
  const seen: { url: string; auth: string | undefined }[] = [];
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://x");
      seen.push({ url: `${url.pathname}${url.search}`, auth: req.headers.authorization });
      const json = (body: unknown, status = 200) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
      if (req.headers.authorization !== "Bearer edau_product_test") return json({ error: "A valid key is needed" }, 401);
      if (url.searchParams.get("id") === "empty") return json({ rows: [], next_page: null, about: null });
      const n = Number(url.searchParams.get("page"));
      if (n === 1) return json({ ...ta, rows: ta.rows.slice(0, 2), next_page: 2 });
      return json({ ...ta, about: undefined, rows: ta.rows.slice(2), next_page: null });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/v1/feed`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("pages through one read with the product key", async () => {
    const wanted = measure.labels;
    const r = await edauSlice({ base, key: "edau_product_test" }, measure.dataset, wanted);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(4);
    expect(r.meta?.titleCy).toBe("Pobl ddigartref mewn llety dros dro yn ôl awdurdod lleol");
    expect(seen[0]).toEqual({ url: `/api/v1/feed/dataset?id=${measure.dataset}&slice=${encodeURIComponent(ta.slice)}&page=1`, auth: "Bearer edau_product_test" });
    expect(seen[1].url).toContain("&page=2");
  });

  it("fails, so the figures already shown are kept, when Edau holds no rows or refuses the key", async () => {
    expect(await edauSlice({ base, key: "edau_product_test" }, "empty", "whole")).toEqual({ ok: false, error: "Edau holds no rows for this read yet" });
    expect((await edauSlice({ base, key: "wrong" }, "x", "whole")).ok).toBe(false);
  });
});
