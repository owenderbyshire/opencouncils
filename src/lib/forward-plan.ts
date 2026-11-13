/**
 * Planned decisions: who a council says will take them. No imports: the
 * pipeline and the website both use this file.
 */

/** "Cabinet" (or "The Executive", "Executive Board") as one of the bodies named, between commas. */
const BODY = /(?:^|,\s*)(?:the\s+)?(?:cabinet|executive|executive board|executive committee)(?=\s*(?:,|$))/i;
/** A single Cabinet member deciding: "Cabinet Member for Education", "Individual Cabinet Member Decisions", "Portfolio Holder". */
const MEMBER = /\b(?:cabinet|executive)\s+(?:board\s+)?members?\b|\bportfolio\s+holder\b/i;
const NOT_MEMBER = /\b(?:shadow|assistant)\s+(?:cabinet|executive)\b/i;
/** The leader or deputy leader deciding alone. */
const LEADER = /(?:^|,\s*)(?:the\s+)?(?:deputy\s+)?leader(?:\s+of\s+(?:the\s+)?council)?(?=\s*(?:,|$))/i;

/**
 * Whether the Cabinet, or a member of it deciding alone, is among the bodies
 * a council names as taking a decision. "Cabinet Sub-Committee" and scrutiny
 * committees that look at a matter on its way to the Cabinet are not.
 */
export function isExecutiveMaker(makers: string | null | undefined): boolean {
  const t = (makers ?? "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  return BODY.test(t) || LEADER.test(t) || (MEMBER.test(t) && !NOT_MEMBER.test(t));
}

/** A calendar date some days on (or back) from another, both as YYYY-MM-DD. */
export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
