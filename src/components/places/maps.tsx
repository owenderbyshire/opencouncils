import Link from "next/link";
import type { Place, PlaceLsoa, PlacesIndex } from "@/data/places";

/*
 * Maps drawn as plain SVG from the paths the places job stores. Coordinates are
 * tens of metres on the British National Grid, so no projection is needed.
 */

type Box = Place["box"];

function viewBox(b: Box, padShare = 0.03): string {
  const pad = Math.round(Math.max(b.w, b.h) * padShare);
  return `${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`;
}

/** Map classes 1 to 5, or 0 for no figure. */
export type MapClass = 0 | 1 | 2 | 3 | 4 | 5;
export const mapFill = (c: MapClass) => (c ? `var(--map-${c})` : "var(--map-none)");

/**
 * The shapes of a constituency's neighbourhoods, drawn once (hidden) so that
 * each map on the page can reuse them with <use> instead of repeating them.
 */
export function NeighbourhoodShapes({ place }: { place: Place }) {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <defs>
        {place.lsoas.map((l) => (
          <path key={l.code} id={`h-${l.code}`} d={l.d} vectorEffect="non-scaling-stroke" />
        ))}
        <path id="h-outline" d={place.d} vectorEffect="non-scaling-stroke" />
      </defs>
    </svg>
  );
}

/** A constituency's neighbourhoods, each shaded by a class, with the constituency's outline on top. Needs <NeighbourhoodShapes> on the page. */
export function NeighbourhoodMap({
  place,
  label,
  classOf,
  titleOf,
}: {
  place: Place;
  label: string;
  classOf: (l: PlaceLsoa) => MapClass;
  titleOf: (l: PlaceLsoa) => string;
}) {
  return (
    <svg viewBox={viewBox(place.box)} role="img" aria-label={label} data-hoods="" className="h-auto max-h-[70vh] w-full">
      <g stroke="var(--bg)" strokeWidth={0.6} strokeLinejoin="round">
        {place.lsoas.map((l) => (
          <use key={l.code} href={`#h-${l.code}`} data-code={l.code} fill={mapFill(classOf(l))}>
            <title>{titleOf(l)}</title>
          </use>
        ))}
      </g>
      <use href="#h-outline" fill="none" stroke="var(--ink)" strokeWidth={1.25} strokeLinejoin="round" pointerEvents="none" />
    </svg>
  );
}

export function MapLegend({ title, items }: { title: string; items: Array<{ cls: MapClass; label: string }> }) {
  return (
    <div className="text-small">
      <div className="mb-1.5 font-semibold">{title}</div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {items.map((i) => (
          <li key={i.label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block size-3.5 rounded-[2px] border border-rule" style={{ background: mapFill(i.cls) }} />
            {i.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The council areas of Wales, each a link; `current` is drawn in the accent. */
export function WalesMap({
  index,
  hrefFor,
  current,
  label,
  className = "",
}: {
  index: PlacesIndex;
  hrefFor: (slug: string) => string;
  current?: string;
  label: string;
  className?: string;
}) {
  return (
    <svg viewBox={viewBox(index.box, 0.02)} role="img" aria-label={label} className={`h-auto w-full ${className}`}>
      {index.councils.map((c) => (
        <Link key={c.slug} href={hrefFor(c.slug)} aria-label={c.name}>
          <path
            d={c.d}
            fill={c.slug === current ? "var(--accent)" : "var(--map-1)"}
            stroke="var(--bg)"
            strokeWidth={1.25}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className={c.slug === current ? "" : "transition-colors hover:fill-[var(--map-3)] focus:fill-[var(--map-3)]"}
          >
            <title>{c.name}</title>
          </path>
        </Link>
      ))}
    </svg>
  );
}
