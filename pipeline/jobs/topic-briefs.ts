/**
 * Monthly overviews of each topic across Wales's councils (data/curated/topics.ts):
 * what's happening, the pressing issues, and the policy context.
 *
 * Two steps per topic. First, a search of official sites only (the Welsh
 * Government, the Senedd, the WLGA, Audit Wales, the Future Generations
 * Commissioner) for current policy, keeping the exact text each result is
 * cited for. Second, a write-up from that text, the past six weeks of council
 * records on the topic held here, and open consultations. Every point must
 * cite at least one of those sources, and every figure in it must appear in
 * the text of a source it cites; anything else is dropped.
 *
 *   pnpm pipeline topic-briefs [--topic housing] [--force]
 */
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { TOPICS } from "../../data/curated/topics";
import { topicBriefs } from "../../src/db/schema";
import { AI_MODEL, cachedSystem, costPence } from "../../src/lib/ai/config";
import type { BriefPoint, BriefSource, TopicBriefContent } from "../../src/lib/topic-brief";
import { COUNCILS } from "../../data/curated/councils";
import { PartialFailure, type Job } from "../lib/job";
import { argNumber, argString } from "../lib/util";
import { numbersSupported } from "../sources/ldp";

const MODEL = process.env.BRIEF_MODEL || AI_MODEL;
const DOMAINS = ["gov.wales", "senedd.wales", "wlga.wales", "audit.wales", "futuregenerations.wales"];
const DAYS = 45;

const POINTS = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["en", "cy", "sources"],
    properties: {
      en: { type: "string", description: "One or two short, plain English sentences. British English, no em dashes, no opinion." },
      cy: { type: "string", description: "The same in natural Welsh, written for Welsh readers. Same figures." },
      sources: { type: "array", items: { type: "string" }, description: "The ids (r…, c…, w…) of the sources this point rests on. At least one." },
    },
  },
} as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "happening", "issues", "policy"],
  properties: {
    summary: { ...POINTS.items, description: "Two sentences: the state of this topic across Welsh councils this month." },
    happening: { ...POINTS, description: "Two to four points on what councils have been deciding and discussing, from the council records (r…). Name councils. Say what was decided." },
    issues: { ...POINTS, description: "Two to four points on the pressures that come up repeatedly in the records, consultations and official sources: costs, demand, shortages, deadlines." },
    policy: { ...POINTS, description: "Two to four points on the national policy context from the official sources (w…) and consultations (c…): laws, funding, targets, reviews. Empty if the sources give none." },
  },
} as const;

const Point = z.object({ en: z.string(), cy: z.string(), sources: z.array(z.string()) });
const Output = z.object({ summary: Point, happening: z.array(Point), issues: z.array(Point), policy: z.array(Point) });

const SYSTEM = `You write a short monthly briefing on one topic across Wales's 22 councils, for members of the public, journalists and officials. Plain language, British English, natural Welsh. Neutral: report what the sources say, never judge, predict or recommend. Use only the sources given; every point cites the ids of the sources it rests on, and every figure in a point must appear in a source it cites. If the sources don't support a section, give fewer points or none.`;

interface Src extends BriefSource {
  text: string;
}

export const topicBriefsJob: Job = {
  name: "topic-briefs",
  description: "Monthly overviews of each topic: what's happening, pressing issues and policy context",
  async run(ctx) {
    if (!process.env.ANTHROPIC_API_KEY) {
      ctx.log("no ANTHROPIC_API_KEY; skipping");
      return;
    }
    if (ctx.args.show === true) {
      // Print the latest overviews, for checking by hand.
      const rows = await ctx.db.execute<{ topic: string; month: string; content: TopicBriefContent }>(sql`
        select distinct on (topic) topic, month, content from topic_briefs order by topic, month desc`);
      for (const r of rows) ctx.log(`BRIEF ${r.topic} ${r.month} ${JSON.stringify(r.content)}`);
      return;
    }
    const client = new Anthropic();
    const month = new Date().toISOString().slice(0, 7);
    const only = argString(ctx.args, "topic");
    let budget = argNumber(ctx.args, "budget") ?? 300;
    const problems: string[] = [];
    const councilName = new Map(COUNCILS.map((c) => [c.id, c.shortEn]));

    for (const topic of TOPICS.filter((t) => !only || t.slug === only)) {
      if (budget <= 0) break;
      const [had] = await ctx.db.select({ id: topicBriefs.id }).from(topicBriefs).where(and(eq(topicBriefs.topic, topic.slug), eq(topicBriefs.month, month)));
      if (had && ctx.args.force !== true) {
        ctx.count("alreadyWritten");
        continue;
      }
      const from = new Date(Date.now() - DAYS * 86_400_000).toISOString().slice(0, 10);

      // Council records on the topic: the main committees first, then the newest.
      const records = await ctx.db.execute<{ c: string; m: number; d: string; kind: string; title: string; headline: string | null; decided: string | null; decision: string | null }>(sql`
        select council_id as c, meeting_id as m, date::text as d, committee_kind as kind, title, headline_en as headline, decided_en as decided, decision
        from search_items where ${topic.slug} = any(topics) and date >= ${from}::date and date <= current_date
        order by (committee_kind in ('council', 'cabinet', 'scrutiny', 'planning')) desc, date desc limit 60`);
      const consultations = await ctx.db.execute<{ url: string; title: string; source: string; closes: string | null; summary: string | null }>(sql`
        select url, title_en as title, source, closes::text as closes, summary_en as summary
        from consultations where ${topic.slug} = any(topics) and (open or closes >= ${from}::date)
        order by closes nulls last limit 15`);
      const sources: Src[] = [
        ...records.map((r, i) => ({
          id: `r${i + 1}`,
          kind: "record" as const,
          title: r.headline || r.title,
          url: null,
          councilId: r.c,
          meetingId: Number(r.m),
          date: r.d,
          text: `${councilName.get(r.c) ?? r.c} (${r.kind}, ${r.d}): ${r.headline || r.title}. ${(r.decided || r.decision || "").slice(0, 500)}`,
        })),
        ...consultations.map((c, i) => ({
          id: `c${i + 1}`,
          kind: "consultation" as const,
          title: c.title,
          url: c.url,
          councilId: c.source === "gov" ? null : c.source,
          meetingId: null,
          date: c.closes,
          text: `${c.source === "gov" ? "Welsh Government" : (councilName.get(c.source) ?? c.source)} consultation${c.closes ? ` closing ${c.closes}` : ""}: ${c.title}. ${(c.summary ?? "").slice(0, 400)}`,
        })),
      ];

      let pence = 0;
      try {
        // Step 1: official sources on the policy context, with the text each is cited for.
        const research = await client.messages.create({
          model: MODEL,
          max_tokens: 4000,
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5, allowed_domains: DOMAINS }],
          messages: [
            {
              role: "user",
              content: `Find the current national policy context in Wales for this topic, as it affects councils: ${topic.en} (${topic.noteEn}). Look for Welsh Government announcements, laws and funding, Senedd committee reports, and WLGA or Audit Wales reports from the past six months. Write brief factual notes, citing each source.`,
            },
          ],
        });
        pence += costPence(MODEL, research.usage);
        const web = new Map<string, Src>();
        for (const block of research.content) {
          if (block.type !== "text" || !block.citations) continue;
          for (const c of block.citations) {
            if (c.type !== "web_search_result_location") continue;
            const had = web.get(c.url);
            if (had) {
              if (!had.text.includes(c.cited_text)) had.text += ` … ${c.cited_text}`;
            } else
              web.set(c.url, { id: `w${web.size + 1}`, kind: "web", title: c.title ?? c.url, url: c.url, councilId: null, meetingId: null, date: null, text: c.cited_text });
          }
        }
        sources.push(...web.values());
        ctx.count("webSources", web.size);

        if (!sources.length) {
          ctx.log(`${topic.slug}: no sources this month`);
          continue;
        }

        // Step 2: the briefing, from the sources only.
        const listing = sources.map((s) => `[${s.id}] ${s.kind === "web" ? `${s.title} (${s.url}): ` : ""}${s.text}`).join("\n");
        const reply = await client.messages
          .stream({
            model: MODEL,
            max_tokens: 12000,
            system: cachedSystem(SYSTEM),
            messages: [{ role: "user", content: `Topic: ${topic.en}. ${topic.noteEn}\nCouncil records cover ${from} to today.\n\nSources:\n${listing}` }],
            output_config: { format: { type: "json_schema", schema: SCHEMA } },
          })
          .finalMessage();
        pence += costPence(MODEL, reply.usage);
        const block = reply.content.find((b) => b.type === "text");
        const parsed = Output.safeParse(JSON.parse(block && block.type === "text" ? block.text : "{}"));
        if (!parsed.success) {
          problems.push(`${topic.slug}: reply didn't match the schema`);
          continue;
        }

        const byId = new Map(sources.map((s) => [s.id, s]));
        const check = (p: BriefPoint): BriefPoint | null => {
          const cited = p.sources.filter((id) => byId.has(id));
          const text = cited.map((id) => byId.get(id)!.text).join(" ");
          const ok = cited.length > 0 && p.en.trim().length > 20 && p.cy.trim().length > 20 && !/—/.test(p.en + p.cy) && numbersSupported(p.en, text) && numbersSupported(p.cy, text);
          if (!ok) ctx.count("pointsDropped");
          return ok ? { en: p.en.trim(), cy: p.cy.trim(), sources: cited } : null;
        };
        const keep = (ps: BriefPoint[]) => ps.map(check).filter((p): p is BriefPoint => p !== null).slice(0, 4);
        const content: TopicBriefContent = {
          summary: check(parsed.data.summary),
          happening: keep(parsed.data.happening),
          issues: keep(parsed.data.issues),
          policy: keep(parsed.data.policy),
          sources: [],
          recordsFrom: from,
        };
        // Keep only the sources that something cites.
        const used = new Set([content.summary, ...content.happening, ...content.issues, ...content.policy].flatMap((p) => p?.sources ?? []));
        content.sources = sources.filter((s) => used.has(s.id)).map((s) => ({ id: s.id, kind: s.kind, title: s.title, url: s.url, councilId: s.councilId, meetingId: s.meetingId, date: s.date }));

        await ctx.db
          .insert(topicBriefs)
          .values({ topic: topic.slug, month, content, model: MODEL, costPence: pence })
          .onConflictDoUpdate({ target: [topicBriefs.topic, topicBriefs.month], set: { content, model: MODEL, costPence: pence, createdAt: new Date() } });
        ctx.count("written");
        ctx.touched.add("topics");
      } catch (e) {
        const msg = (e as Error).message;
        problems.push(`${topic.slug}: ${msg.slice(0, 200)}`);
        if (/credit balance/i.test(msg)) break;
      } finally {
        budget -= pence;
        ctx.count("pence", Math.round(pence));
      }
    }
    if (problems.length) throw new PartialFailure(problems.join("; "));
  },
};
