/**
 * OpenCouncil's logo (docs/tile-logos.md): a rounded tile in the accent
 * holding a civic building in --accent-ink, so it follows the theme. It sits
 * beside the wordmark, which names the site, so it is aria-hidden.
 */
export function TileLogo({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" className="block shrink-0">
      <rect width="48" height="48" rx="12" fill="var(--accent)" />
      <g
        transform="translate(8 8) scale(1.3333)"
        fill="none"
        stroke="var(--accent-ink)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 7.5 12 3l9 4.5" />
        <path d="M3 20h4M10 20h4M17 20h4" />
        <path d="M6 10v7.5M12 10v7.5M18 10v7.5" />
        <path d="M3 11h1.5M7.5 11h3M13.5 11h3M19.5 11h1.5" />
      </g>
    </svg>
  );
}
