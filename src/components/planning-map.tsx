"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapGeoJSONFeature } from "maplibre-gl";
import { href, type Locale } from "@/i18n/config";
import { formatDate, formatNumber } from "@/i18n/format";

/*
 * A map of Wales with every planning application still waiting for a
 * decision. Points come from /api/planning/live; nearby points are grouped
 * into numbered circles until you zoom in. Selecting a point shows the
 * application's summary, fetched from /api/planning/live/<id>, with a link to
 * its page. Base map: OpenStreetMap data, served by OpenFreeMap.
 */

export interface PlanningMapLabels {
  region: string;
  loading: string;
  failed: string;
  received: string;
  consultation: string;
  open: string;
  comment: string;
  shown: string;
  zoomHint: string;
}

interface Summary {
  id: number;
  reference: string | null;
  address: string | null;
  description: string | null;
  startDate: string | null;
  consultedDate: string | null;
  commentUrl: string | null;
}

const KINDS = ["new", "trees", "other"] as const;
const STYLE = { light: "https://tiles.openfreemap.org/styles/positron", dark: "https://tiles.openfreemap.org/styles/dark" };
/** Wales, with a little room around it. */
const BOUNDS: [[number, number], [number, number]] = [
  [-5.4, 51.3],
  [-2.6, 53.5],
];

/** Dark mode is on only when the reader has chosen it. */
function isDark(): boolean {
  return document.documentElement.dataset.theme === "dark";
}

function cssVar(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Builds the pop-up from text nodes only: register text never becomes HTML. */
function popupContent(locale: Locale, s: Summary, labels: PlanningMapLabels, today: string): HTMLElement {
  const box = document.createElement("div");
  box.className = "planning-pop";
  const add = (tag: string, text: string, className?: string) => {
    const el = document.createElement(tag);
    el.textContent = text;
    if (className) el.className = className;
    box.appendChild(el);
    return el;
  };
  if (s.address) add("p", s.address, "font-semibold");
  if (s.description) add("p", s.description);
  const meta = [s.reference, s.startDate ? labels.received.replace("{date}", formatDate(locale, s.startDate, "short")) : null];
  if (s.consultedDate && s.consultedDate >= today) meta.push(labels.consultation.replace("{date}", formatDate(locale, s.consultedDate, "short")));
  add("p", meta.filter(Boolean).join(". "), "text-ink-2");
  const links = document.createElement("p");
  const open = document.createElement("a");
  open.href = href(locale, `/planning/application/${s.id}`);
  open.textContent = labels.open;
  links.appendChild(open);
  if (s.commentUrl) {
    links.appendChild(document.createTextNode("  "));
    const c = document.createElement("a");
    c.href = s.commentUrl;
    c.rel = "noopener";
    c.textContent = labels.comment;
    c.lang = "en";
    links.appendChild(c);
  }
  links.className = "flex flex-wrap gap-x-4";
  box.appendChild(links);
  return box;
}

export function PlanningMap({ locale, kind, labels }: { locale: Locale; kind: (typeof KINDS)[number] | "all"; labels: PlanningMapLabels }) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let map: MapLibreMap | null = null;
    let cancelled = false;
    (async () => {
      const [{ default: maplibregl }, res] = await Promise.all([import("maplibre-gl"), fetch("/api/planning/live")]);
      if (cancelled || !holder.current) return;
      if (!res.ok) {
        setState("failed");
        return;
      }
      const data = (await res.json()) as { points: Array<[number, number, number, number]> };
      const want = kind === "all" ? null : KINDS.indexOf(kind);
      const points = data.points.filter((p) => want === null || p[3] === want);
      setCount(points.length);
      const geojson = {
        type: "FeatureCollection" as const,
        features: points.map(([id, lng, lat]) => ({ type: "Feature" as const, id, properties: { id }, geometry: { type: "Point" as const, coordinates: [lng, lat] } })),
      };
      const accent = cssVar("--accent", "#355d91");
      const accentInk = cssVar("--accent-ink", "#ffffff");
      const surface = cssVar("--surface", "#ffffff");
      const today = new Date().toISOString().slice(0, 10);

      map = new maplibregl.Map({
        container: holder.current,
        style: isDark() ? STYLE.dark : STYLE.light,
        bounds: BOUNDS,
        maxBounds: [
          [-7.5, 50.5],
          [-1.0, 54.3],
        ],
        attributionControl: { compact: true },
        cooperativeGestures: true,
        locale: locale === "cy" ? { "CooperativeGesturesHandler.WindowsHelpText": "Defnyddiwch Ctrl + sgrolio i chwyddo'r map", "CooperativeGesturesHandler.MacHelpText": "Defnyddiwch ⌘ + sgrolio i chwyddo'r map", "CooperativeGesturesHandler.MobileHelpText": "Defnyddiwch ddau fys i symud y map" } : undefined,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("error", () => {
        // A missing tile is no reason to give up; only a style that never loads is.
        if (!map?.isStyleLoaded()) setState((s) => (s === "ready" ? s : "loading"));
      });

      map.on("load", () => {
        if (!map) return;
        map.addSource("live", { type: "geojson", data: geojson, cluster: true, clusterRadius: 44, clusterMaxZoom: 14 });
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "live",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": accent,
            "circle-opacity": 0.85,
            "circle-stroke-color": surface,
            "circle-stroke-width": 2,
            "circle-radius": ["step", ["get", "point_count"], 13, 25, 17, 100, 22, 500, 28],
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "live",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Noto Sans Regular"] },
          paint: { "text-color": accentInk },
        });
        map.addLayer({
          id: "points",
          type: "circle",
          source: "live",
          filter: ["!", ["has", "point_count"]],
          paint: { "circle-color": accent, "circle-radius": 6, "circle-stroke-color": surface, "circle-stroke-width": 2 },
        });

        map.on("click", "clusters", async (e) => {
          const f = e.features?.[0] as MapGeoJSONFeature | undefined;
          if (!f || !map) return;
          const zoom = await (map.getSource("live") as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id as number);
          map.easeTo({ center: (f.geometry as { coordinates: [number, number] }).coordinates as [number, number], zoom });
        });
        map.on("click", "points", async (e) => {
          const f = e.features?.[0];
          if (!f || !map) return;
          const at = (f.geometry as { coordinates: [number, number] }).coordinates as [number, number];
          const popup = new maplibregl.Popup({ maxWidth: "320px" }).setLngLat(at).setText(labels.loading).addTo(map);
          const r = await fetch(`/api/planning/live/${f.properties.id}`).catch(() => null);
          if (!r?.ok) {
            popup.setText(labels.failed);
            return;
          }
          popup.setDOMContent(popupContent(locale, (await r.json()) as Summary, labels, today));
        });
        for (const layer of ["clusters", "points"]) {
          map.on("mouseenter", layer, () => map && (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => map && (map.getCanvas().style.cursor = ""));
        }
        setState("ready");
      });
    })().catch(() => setState("failed"));
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [kind, locale, labels]);

  return (
    <div>
      <p className="mb-2 text-small text-ink-2" aria-live="polite">
        {state === "failed" ? labels.failed : count === null ? labels.loading : labels.shown.replace("{n}", formatNumber(locale, count))}
      </p>
      <div ref={holder} role="region" aria-label={labels.region} className="h-[70vh] min-h-[420px] w-full border border-rule bg-surface-2" />
      <p className="mt-2 text-small text-ink-3">{labels.zoomHint}</p>
    </div>
  );
}
