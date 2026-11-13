/**
 * Applications waiting for a decision, as points for the planning map
 * (src/components/planning-map.tsx). Refreshed when the pipeline updates
 * planning data.
 */
import { liveApplicationMap } from "@/data/planning";

export async function GET() {
  return Response.json(await liveApplicationMap());
}
