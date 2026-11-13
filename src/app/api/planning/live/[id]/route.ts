/** One application's summary, for the planning map's pop-up. */
import { getApplication } from "@/data/planning";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return Response.json({ error: "not found" }, { status: 404 });
  const a = await getApplication(n);
  if (!a) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({
    id: a.id,
    authority: a.authority,
    reference: a.reference,
    address: a.address,
    description: a.description && a.description.length > 280 ? `${a.description.slice(0, 277).trimEnd()}…` : a.description,
    appType: a.appType,
    startDate: a.startDate,
    consultedDate: a.consultedDate,
    commentUrl: a.commentUrl,
  });
}
