/**
 * Small line illustrations for the home and about pages: ink outlines with
 * one accent fill each. Decorative: always aria-hidden, with the meaning
 * carried by the text beside them.
 */
type Props = { size?: number; className?: string };

function Frame({ size = 56, className = "", children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 56"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

const accent = { fill: "var(--accent)", stroke: "none" } as const;
const soft = { fill: "var(--accent-soft)", stroke: "none" } as const;

/** A page of minutes with the decision marked. */
export function DecisionArt(p: Props) {
  return (
    <Frame {...p}>
      <rect x="11" y="6" width="30" height="40" rx="2" style={soft} />
      <rect x="11" y="6" width="30" height="40" rx="2" />
      <path d="M17 15h18M17 21h18M17 27h10" />
      <circle cx="40" cy="40" r="9" style={accent} />
      <path d="M36 40l3 3 5-6" stroke="var(--accent-ink)" strokeWidth="2.2" />
    </Frame>
  );
}

/** Two people and a map pin: your ward and its councillors. */
export function CouncillorsArt(p: Props) {
  return (
    <Frame {...p}>
      <circle cx="18" cy="20" r="6" />
      <path d="M8 40c0-6 4.5-10 10-10s10 4 10 10" />
      <circle cx="32" cy="17" r="5" />
      <path d="M27 27c1.5-1 3.2-1.5 5-1.5 5 0 8.5 3.5 8.5 9" />
      <path d="M44 30c-4 0-7 3-7 6.8 0 5 7 11.2 7 11.2s7-6.2 7-11.2c0-3.8-3-6.8-7-6.8z" style={accent} />
      <circle cx="44" cy="37" r="2.3" fill="var(--accent-ink)" stroke="none" />
    </Frame>
  );
}

/** Papers from many councils under one magnifying glass. */
export function SearchArt(p: Props) {
  return (
    <Frame {...p}>
      <rect x="6" y="12" width="20" height="26" rx="2" />
      <rect x="12" y="8" width="20" height="26" rx="2" style={soft} />
      <rect x="12" y="8" width="20" height="26" rx="2" />
      <path d="M17 16h10M17 21h10M17 26h6" />
      <circle cx="35" cy="34" r="9" style={{ fill: "var(--bg)" }} />
      <circle cx="35" cy="34" r="9" />
      <path d="M41.5 40.5l7 7" strokeWidth="3" stroke="var(--accent)" />
    </Frame>
  );
}

/** A feed and a calendar: follow without signing up. */
export function FollowArt(p: Props) {
  return (
    <Frame {...p}>
      <rect x="6" y="14" width="26" height="26" rx="3" />
      <path d="M6 21h26M13 10v7M25 10v7" />
      <rect x="11" y="26" width="5" height="5" rx="1" style={accent} />
      <circle cx="38" cy="42" r="2.6" style={accent} />
      <path d="M38 33a9 9 0 0 1 9 9" stroke="var(--accent)" strokeWidth="2.4" />
      <path d="M38 25a17 17 0 0 1 17 17" stroke="var(--accent)" strokeWidth="2.4" />
    </Frame>
  );
}

/* Steps from a council's papers to a summary. */

export function AgendaStep(p: Props) {
  return (
    <Frame {...p}>
      <rect x="12" y="7" width="28" height="38" rx="2" />
      <rect x="18" y="4" width="16" height="6" rx="2" style={soft} />
      <rect x="18" y="4" width="16" height="6" rx="2" />
      <path d="M18 18h4M25 18h10M18 25h4M25 25h10M18 32h4M25 32h7" />
    </Frame>
  );
}

export function MeetingStep(p: Props) {
  return (
    <Frame {...p}>
      <ellipse cx="28" cy="30" rx="15" ry="8" style={soft} />
      <ellipse cx="28" cy="30" rx="15" ry="8" />
      {[
        [10, 21],
        [22, 16],
        [34, 16],
        [46, 21],
        [46, 39],
        [10, 39],
      ].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3" style={accent} />
      ))}
    </Frame>
  );
}

export function MinutesStep(p: Props) {
  return (
    <Frame {...p}>
      <rect x="12" y="6" width="28" height="40" rx="2" />
      <path d="M18 14h16M18 20h16M18 26h12" />
      <rect x="17" y="32" width="18" height="8" rx="1.5" style={accent} />
      <path d="M20 36h12" stroke="var(--accent-ink)" />
    </Frame>
  );
}

export function ExplainedStep(p: Props) {
  return (
    <Frame {...p}>
      <path d="M6 12h24a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H16l-6 5v-5H6a3 3 0 0 1-3-3V15a3 3 0 0 1 3-3z" style={soft} />
      <path d="M6 12h24a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H16l-6 5v-5H6a3 3 0 0 1-3-3V15a3 3 0 0 1 3-3z" />
      <path d="M50 24H28a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h12l6 5v-5h4a3 3 0 0 0 3-3V27a3 3 0 0 0-3-3z" style={accent} />
      <text x="11" y="24.5" fontSize="9" fontWeight="700" fill="currentColor" stroke="none" fontFamily="var(--font-sans)">
        EN
      </text>
      <text x="33" y="36.5" fontSize="9" fontWeight="700" fill="var(--accent-ink)" stroke="none" fontFamily="var(--font-sans)">
        CY
      </text>
    </Frame>
  );
}
