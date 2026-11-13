import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ukToday } from "@/i18n/format";
import { withoutPastWatch, type CouncilBriefContent } from "@/lib/council-brief";
import type { TopicBriefContent } from "@/lib/topic-brief";
import { one, sql } from "./db";

/** The latest monthly overview of a topic (pipeline/jobs/topic-briefs.ts). */
export async function topicBrief(topic: string): Promise<{ month: string; createdAt: string; content: TopicBriefContent } | null> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("topics");
  return one<{ month: string; createdAt: string; content: TopicBriefContent }>(sql`
    select month, created_at::text as "createdAt", content from topic_briefs
    where topic = ${topic} order by month desc limit 1`);
}

/** The latest monthly overview of a council (pipeline/jobs/council-briefs.ts). */
export async function councilBrief(councilId: string): Promise<{ month: string; createdAt: string; content: CouncilBriefContent } | null> {
  "use cache";
  // Hours, not days: points about meetings that have since happened drop out on the day.
  cacheLife("hours");
  cacheTag("councils");
  const b = await one<{ month: string; createdAt: string; content: CouncilBriefContent }>(sql`
    select month, created_at::text as "createdAt", content from council_briefs
    where council_id = ${councilId} order by month desc limit 1`).catch(() => null);
  return b ? { ...b, content: withoutPastWatch(b.content, ukToday()) } : null;
}
