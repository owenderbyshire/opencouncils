import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { subscribers } from "@/db/schema";

/** One subscriber's choices, for the page linked from their weekly email. Never cached: it's personal. */
export async function getSubscriber(id: string) {
  const [s] = await getDb()
    .select({ id: subscribers.id, councils: subscribers.councils, topics: subscribers.topics, postcode: subscribers.postcode, keywords: subscribers.keywords, instant: subscribers.instant, status: subscribers.status })
    .from(subscribers)
    .where(eq(subscribers.id, id));
  return s ?? null;
}
