/**
 * The Open family's line icons (docs/family-design.md): 20px, 1.5px stroke,
 * round joins, in the current colour. They mark sections and kinds of record
 * beside text that says the same thing, so they are always aria-hidden.
 */
const PATHS = {
  // Full Council: a chamber of seats in a horseshoe.
  council: (
    <>
      <path d="M3 15a7 7 0 0 1 14 0" />
      <circle cx="4.5" cy="10.5" r="1" />
      <circle cx="7" cy="7.2" r="1" />
      <circle cx="10" cy="6" r="1" />
      <circle cx="13" cy="7.2" r="1" />
      <circle cx="15.5" cy="10.5" r="1" />
      <path d="M8 15h4" />
    </>
  ),
  // Cabinet: a small group round a table.
  cabinet: (
    <>
      <rect x="5" y="8" width="10" height="5" rx="1" />
      <circle cx="7.5" cy="5" r="1.3" />
      <circle cx="12.5" cy="5" r="1.3" />
      <circle cx="7.5" cy="16" r="1.3" />
      <circle cx="12.5" cy="16" r="1.3" />
    </>
  ),
  // Scrutiny: a magnifying glass over a page.
  scrutiny: (
    <>
      <path d="M4 3h7l3 3v4" />
      <path d="M4 3v14h5" />
      <circle cx="13" cy="13" r="3" />
      <path d="M15.2 15.2 17.5 17.5" />
    </>
  ),
  // Planning: a house on a site plan.
  planning: (
    <>
      <path d="M3 17h14" />
      <path d="M5 17V9.5L10 5l5 4.5V17" />
      <path d="M8.5 17v-4h3v4" />
    </>
  ),
  meetings: (
    <>
      <rect x="3" y="4.5" width="14" height="12.5" rx="1.5" />
      <path d="M3 8.5h14M7 2.5v4M13 2.5v4" />
      <path d="M6.5 12h2M11.5 12h2" />
    </>
  ),
  councillors: (
    <>
      <circle cx="7.5" cy="7" r="2.5" />
      <path d="M2.5 16.5a5 5 0 0 1 10 0" />
      <circle cx="14" cy="7.5" r="2" />
      <path d="M13.5 12a4 4 0 0 1 4 4.5" />
    </>
  ),
  committees: (
    <>
      <circle cx="10" cy="10" r="3.5" />
      <circle cx="10" cy="3.5" r="1.3" />
      <circle cx="16" cy="12.5" r="1.3" />
      <circle cx="4" cy="12.5" r="1.3" />
      <circle cx="10" cy="16.5" r="1.3" />
    </>
  ),
  decisions: (
    <>
      <path d="M5 2.5h7l3 3v12H5z" />
      <path d="M7.5 11l2 2 3.5-4" />
    </>
  ),
  issues: (
    <>
      <circle cx="4.5" cy="5" r="1.8" />
      <circle cx="15.5" cy="15" r="1.8" />
      <path d="M6.3 5H12a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h5.7" />
    </>
  ),
  topics: (
    <>
      <path d="M3 3h6.5l7.5 7.5-6.5 6.5L3 9.5z" />
      <circle cx="7" cy="7" r="1.2" />
    </>
  ),
  search: (
    <>
      <circle cx="8.5" cy="8.5" r="5" />
      <path d="M12.3 12.3 17 17" />
    </>
  ),
  find: (
    <>
      <path d="M10 17.5s-5.5-5-5.5-9a5.5 5.5 0 0 1 11 0c0 4-5.5 9-5.5 9z" />
      <circle cx="10" cy="8.5" r="2" />
    </>
  ),
  area: (
    <>
      <path d="M2.5 5.5 7.5 3.5l5 2 5-2v11l-5 2-5-2-5 2z" />
      <path d="M7.5 3.5v11M12.5 5.5v11" />
    </>
  ),
  money: (
    <>
      <ellipse cx="10" cy="5.5" rx="6" ry="2.5" />
      <path d="M4 5.5v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5.5" />
      <path d="M4 10v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V10" />
    </>
  ),
  performance: (
    <>
      <path d="M3 17h14" />
      <path d="M5.5 17v-5M10 17V7M14.5 17v-8" />
    </>
  ),
  compare: (
    <>
      <path d="M3 17h14" />
      <rect x="4.5" y="8" width="4" height="9" rx="0.5" />
      <rect x="11.5" y="4" width="4" height="13" rx="0.5" />
    </>
  ),
  latest: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4l2.5 2.5" />
    </>
  ),
  elections: (
    <>
      <path d="M3.5 9.5h13v7.5h-13z" />
      <path d="M7 9.5 9 3.5l5 1.5-1.5 4.5" />
      <path d="M7.5 13h5" />
    </>
  ),
  party: (
    <>
      <path d="M10 3a7 7 0 1 0 7 7h-7z" />
      <path d="M12.5 1.5a6 6 0 0 1 6 6h-6z" />
    </>
  ),
  consultations: (
    <>
      <path d="M3 4h14v9H9.5L6 16v-3H3z" />
      <path d="M6.5 7.5h7M6.5 10h4" />
    </>
  ),
  follow: (
    <>
      <path d="M5 13.5V9a5 5 0 0 1 10 0v4.5l1.5 1.5h-13z" />
      <path d="M8.5 17.5h3" />
    </>
  ),
  guide: (
    <>
      <path d="M10 5.5C8 4 5.5 3.5 3 4v11.5c2.5-.5 5 0 7 1.5 2-1.5 4.5-2 7-1.5V4c-2.5-.5-5 0-7 1.5z" />
      <path d="M10 5.5V17" />
    </>
  ),
  plans: (
    <>
      <path d="M10 3 2.5 7 10 11l7.5-4z" />
      <path d="M2.5 10.5 10 14.5l7.5-4" />
      <path d="M2.5 14 10 18l7.5-4" />
    </>
  ),
  league: (
    <>
      <path d="M8 5h9M8 10h7M8 15h5" />
      <path d="M3.5 5h1M3.5 10h1M3.5 15h1" />
    </>
  ),
  about: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 9v5" />
      <circle cx="10" cy="6.3" r="0.6" />
    </>
  ),
  data: (
    <>
      <path d="M10 3v9M6.5 8.5 10 12l3.5-3.5" />
      <path d="M3.5 13v3.5h13V13" />
    </>
  ),
  have: (
    <>
      <path d="M4 10.5V7a1.5 1.5 0 0 1 3 0v3" />
      <path d="M7 9.5V4.5a1.5 1.5 0 0 1 3 0v5" />
      <path d="M10 9.5V5.5a1.5 1.5 0 0 1 3 0v6" />
      <path d="M13 11.5V8.5a1.5 1.5 0 0 1 3 0v3.5a6 6 0 0 1-6 6h-.5A5.5 5.5 0 0 1 4 12.5v-2" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
