/**
 * Allocated sites' boundaries, for the authorities that publish them as map
 * data (pipeline/sources/ldp-areas.ts), and the planning applications whose
 * location falls inside one. Boundaries are read once a week; applications
 * are matched every run, so new ones are picked up.
 *
 *   pnpm pipeline ldp-areas [--force]
 */
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { ldpAreaApplications, ldpAreas, planningApplications } from "../../src/db/schema";
import { fetchText } from "../lib/http";
import { PartialFailure, type Job } from "../lib/job";
import { AREA_LAYERS, bbox, contains, roundGeometry, siteLabel, wfsUrl, type Geometry } from "../sources/ldp-areas";

const WEEK = 7 * 86_400_000;

export const ldpAreasJob: Job = {
  name: "ldp-areas",
  watches: [
    {
      tags: ["planning"],
      sources: [{ table: "ldp_areas" }, { table: "ldp_area_applications" }],
    },
  ],
  description: "Allocated sites' boundaries from published map data, and the planning applications inside them",
  async run(ctx) {
    const problems: string[] = [];
    const last = await ctx.getState<{ at: string }>("ldp-areas-read");
    if (ctx.args.force === true || !last || Date.now() - Date.parse(last.at) > WEEK) {
      for (const l of AREA_LAYERS) {
        const r = await fetchText(wfsUrl(l.url, l.layer), { fresh: true, accept: "application/json" });
        if (!r.ok) {
          problems.push(`${l.layer}: ${r.error}`);
          continue;
        }
        let data: { features?: Array<{ geometry: Geometry | null; properties: Record<string, unknown> | null }> };
        try {
          data = JSON.parse(r.text);
        } catch {
          problems.push(`${l.layer}: not JSON`);
          continue;
        }
        const rows = (data.features ?? [])
          .filter((f) => f.geometry && (f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon"))
          .map((f) => {
            const g = roundGeometry(f.geometry!);
            const [minLng, minLat, maxLng, maxLat] = bbox(g);
            const props = f.properties ?? {};
            const { ref, name } = siteLabel(props);
            return { authority: l.authority, layer: l.layer, use: l.use, ref, name, geometry: g, props, minLng, minLat, maxLng, maxLat };
          })
          // Only places in and around Wales: anything else means the coordinates came back in the wrong system.
          .filter((x) => x.minLat > 51.3 && x.maxLat < 53.5 && x.minLng > -5.5 && x.maxLng < -2.6);
        if (!rows.length) {
          problems.push(`${l.layer}: no usable boundaries`);
          continue;
        }
        await ctx.db.transaction(async (tx) => {
          const old = await tx.select({ id: ldpAreas.id }).from(ldpAreas).where(eq(ldpAreas.layer, l.layer));
          if (old.length) await tx.delete(ldpAreaApplications).where(inArray(ldpAreaApplications.areaId, old.map((o) => o.id)));
          await tx.delete(ldpAreas).where(eq(ldpAreas.layer, l.layer));
          await tx.insert(ldpAreas).values(rows);
        });
        ctx.count(`${l.layer}`, rows.length);
        ctx.log(`${l.layer}: ${rows.length} sites; fields ${Object.keys(rows[0].props).join(", ")}; first ${rows[0].ref ?? "-"} / ${rows[0].name ?? "-"}`);
      }
      if (!problems.length) await ctx.setState("ldp-areas-read", { at: new Date().toISOString() });
    }

    // Match applications to the boundaries.
    const areas = await ctx.db.select().from(ldpAreas);
    for (const authority of [...new Set(areas.map((a) => a.authority))]) {
      const mine = areas.filter((a) => a.authority === authority);
      const apps = await ctx.db
        .select({ name: planningApplications.name, lat: planningApplications.lat, lng: planningApplications.lng })
        .from(planningApplications)
        .where(and(eq(planningApplications.authority, authority), isNotNull(planningApplications.lat)));
      const matches: { areaId: number; application: string }[] = [];
      for (const app of apps) {
        const { lat, lng } = app as { lat: number; lng: number };
        for (const a of mine)
          if (lng >= a.minLng && lng <= a.maxLng && lat >= a.minLat && lat <= a.maxLat && contains(a.geometry as Geometry, lng, lat))
            matches.push({ areaId: a.id, application: app.name });
      }
      await ctx.db.transaction(async (tx) => {
        await tx.delete(ldpAreaApplications).where(inArray(ldpAreaApplications.areaId, mine.map((a) => a.id)));
        for (let i = 0; i < matches.length; i += 500) await tx.insert(ldpAreaApplications).values(matches.slice(i, i + 500)).onConflictDoNothing();
      });
      ctx.count(`${authority} applications on allocated sites`, matches.length);
    }
    if (problems.length) throw new PartialFailure(problems.join("; "));
  },
};
