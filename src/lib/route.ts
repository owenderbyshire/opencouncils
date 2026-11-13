import { notFound } from "next/navigation";
import { liveCouncil, LIVE_COUNCILS, type CouncilConfig } from "./councils";

/** The live council named by the route, or the 404 page. */
export async function councilFrom(params: Promise<{ council: string }>): Promise<CouncilConfig> {
  const { council } = await params;
  const c = liveCouncil(council);
  if (!c) notFound();
  return c;
}

/** Whether a route segment is a database ID: a positive integer that fits Postgres's integer type. */
export function isId(raw: string): boolean {
  return /^\d{1,10}$/.test(raw) && Number(raw) <= 2_147_483_647;
}

/** A positive integer ID from the route, or the 404 page. */
export function idFrom(raw: string): number {
  if (!isId(raw)) notFound();
  return Number(raw);
}

export function councilParams() {
  return LIVE_COUNCILS.map((c) => ({ council: c.id }));
}
