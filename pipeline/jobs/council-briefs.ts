/**
 * Monthly overviews of each council: the state of things, its priorities,
 * what it has decided lately and what to watch for.
 *
 * Two steps per council. First, a search of the council's own website, Audit
 * Wales and the Welsh Government only, for its corporate plan, budget
 * position and recent reports, keeping the exact text each result is cited
 * for. Second, a write-up from that text, the council's make-up, its records
 * from the past three months held here, the agenda for the next six weeks,
 * and its open consultations. Every point must cite at least one of those
 * sources, and every figure in it must appear in the text of a source it
 * cites; anything else is dropped.
 *
 *   pnpm pipeline council-briefs [--council cardiff] [--force]
 */
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { COUNCILS } from "../../data/curated/councils";
import { electionFor } from "../../data/curated/elections";
import { councilBriefs } from "../../src/db/schema";
import { AI_MODEL, costPence } from "../../src/lib/ai/config";
import type { CouncilBriefContent, CouncilBriefSource } from "../../src/lib/council-brief";
import type { BriefPoint } from "../../src/lib/topic-brief";
import { partyName } from "../../src/lib/parties";
import { seatGroups, type PartySeatsRow } from "../../src/lib/seats";
import { currentSeatsQuery } from "../../src/lib/seats-query";
import { PartialFailure, type Job } from "../lib/job";
import { argNumber, argString } from "../lib/util";
import { numbersSupported } from "../sources/ldp";

const MODEL = process.env.BRIEF_MODEL || AI_MODEL;
const PAST_DAYS = 90;
const AHEAD_DAYS = 42;
/** Agenda items that are the same at every meeting. */
const ROUTINE = /apolog|declarations? of interest|minutes of|^minutes$|urgent (business|items?)|exclusion of|date of (the )?next|chair'?s? announce|public questions|^welcome|any other business|forward work programme/i;

const POINTS = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["en", "cy", "sources"],
    properties: {
      en: { type: "string", description: "One or two short, plain English sentences. British English, no em dashes, no opinion." },
      cy: { type: "string", description: "The same in natural Welsh, written for Welsh readers. Same figures." },
      sources: { type: "array", items: { type: "string" }, description: "The ids (f…, r…, u…, c…, w…) of the sources this point rests on. At least one." },
    },
  },
} as const;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "priorities", "recent", "watch"],
  properties: {
    summary: { ...POINTS.items, description: "Two sentences: who runs the council (from f1) and the main thing going on there now." },
    priorities: { ...POINTS, description: "Two to four points on the council's own stated priorities: its corporate plan or well-being objectives, from the council's website (w…). Empty if the sources don't say." },
    recent: { ...POINTS, description: "Two to four points on the most significant things the council decided in the past three months, from its records (r…). Say what was decided and by which body." },
    watch: {
      ...POINTS,
      description:
        "Two to four points on what to watch for: decisions coming up on the agenda (u…), consultations closing (c…), and pressures the official sources describe, such as a budget gap or an Audit Wales finding (w…). Give dates where the sources do.",
    },
  },
} as const;

const Point = z.object({ en: z.string(), cy: z.string(), sources: z.array(z.string()) });
const Output = z.object({ summary: Point, priorities: z.array(Point), recent: z.array(Point), watch: z.array(Point) });

const SYSTEM = `You write a short monthly overview of one Welsh council for members of the public who know nothing about councils. Plain language, British English, natural Welsh. Neutral: report what the sources say, never judge, predict or recommend, and never describe a party or councillor favourably or unfavourably. Explain a term where you use it (Cabinet, scrutiny, call-in). Use only the sources given; every point cites the ids of the sources it rests on, and every figure in a point must appear in a source it cites. If the sources don't support a section, give fewer points or none.`;

interface Src extends CouncilBriefSource {
  text: string;
}

/**
 * Who sits on the council, counted exactly as the chamber diagram on its page
 * counts them (src/lib/seats.ts), so the overview's figures match the chart:
 * by party, with seats that have no councillor listed shown as such.
 */
export function seatsFact(name: string, rows: PartySeatsRow[], size: number | null): string {
  const { groups, listed, vacant } = seatGroups(rows, size);
  if (!listed) return "";
  if (!groups.length) return `${name} Council lists ${listed} councillors. Its list gives no party for them.`;
  const parts = groups.map((g) => `${partyName("en", g.partyId, g.label)} ${g.seats}`).join(", ");
  const empty = vacant === 1 ? " 1 seat has no councillor listed." : vacant > 1 ? ` ${vacant} seats have no councillor listed.` : "";
  return `${name} Council has ${listed + vacant} seats. By party or group: ${parts}.${empty}`;
}

const KIND_EN: Record<string, string> = { majority: "has a majority, led by", minority: "runs it without a majority:", noc: "no party has a majority; it is led by", disputed: "sources differ on who leads it; the largest group is" };

export const councilBriefsJob: Job = {
  name: "council-briefs",
  description: "Monthly overviews of each council: priorities, recent decisions and what to watch",
  async run(ctx) {
    if (!process.env.ANTHROPIC_API_KEY) {
      ctx.log("no ANTHROPIC_API_KEY; skipping");
      return;
    }
    if (ctx.args.show === true) {
      const rows = await ctx.db.execute<{ council_id: string; month: string; content: CouncilBriefContent }>(sql`
        select distinct on (council_id) council_id, month, content from council_briefs order by council_id, month desc`);
      for (const r of rows) ctx.log(`BRIEF ${r.council_id} ${r.month} ${JSON.stringify(r.content)}`);
      return;
    }
    const client = new Anthropic();
    const month = new Date().toISOString().slice(0, 7);
    const only = argString(ctx.args, "council");
    let budget = argNumber(ctx.args, "budget") ?? 600;
    const problems: string[] = [];
    const today = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - PAST_DAYS * 86_400_000).toISOString().slice(0, 10);
    const until = new Date(Date.now() + AHEAD_DAYS * 86_400_000).toISOString().slice(0, 10);

    for (const c of COUNCILS.filter((x) => x.active && (!only || x.id === only))) {
      if (budget <= 0) break;
      const [had] = await ctx.db.select({ id: councilBriefs.id }).from(councilBriefs).where(and(eq(councilBriefs.councilId, c.id), eq(councilBriefs.month, month)));
      if (had && ctx.args.force !== true) {
        ctx.count("alreadyWritten");
        continue;
      }

      // f1: who sits on the council and who runs it, counted as the chamber diagram beside the overview counts them.
      const seats = await ctx.db.execute<PartySeatsRow>(currentSeatsQuery(c.id));
      const e = electionFor(c.id);
      const facts = [
        seatsFact(c.shortEn, [...seats].map((r) => ({ ...r, seats: Number(r.seats) })), e?.election2022.total ?? null),
        e ? `Control: ${KIND_EN[e.control.kind] ?? ""} ${e.control.party === "ind" ? "independent councillors" : partyName("en", e.control.party, e.control.party)}.` : "",
        e?.noteEn ?? "",
      ]
        .filter(Boolean)
        .join(" ");
      const sources: Src[] = facts
        ? [{ id: "f1", kind: "fact", title: `${c.shortEn}: councillors and control`, url: e?.controlSources?.[0] ?? c.website, meetingId: null, date: today, text: facts }]
        : [];

      // r…: what it decided lately, the main committees first.
      const records = await ctx.db.execute<{ m: number; d: string; kind: string; title: string; headline: string | null; decided: string | null; decision: string | null }>(sql`
        select meeting_id as m, date::text as d, committee_kind as kind, title, headline_en as headline, decided_en as decided, decision
        from search_items where council_id = ${c.id} and date >= ${from}::date and date <= current_date
          and (decided_en is not null or decision is not null or headline_en is not null)
        order by (committee_kind in ('council', 'cabinet', 'scrutiny', 'planning')) desc, date desc limit 50`);
      sources.push(
        ...records.map((r, i) => ({
          id: `r${i + 1}`,
          kind: "record" as const,
          title: r.headline || r.title,
          url: null,
          meetingId: Number(r.m),
          date: r.d,
          text: `${r.kind} meeting, ${r.d}: ${r.headline || r.title}. ${(r.decided || r.decision || "").slice(0, 500)}`,
        })),
      );

      // u…: what's coming up on the agenda.
      const upcoming = await ctx.db.execute<{ m: number; d: string; committee: string; kind: string; title: string }>(sql`
        select a.meeting_id as m, mt.date::text as d, co.name_en as committee, co.kind, a.title
        from agenda_items a
        join meetings mt on mt.council_id = a.council_id and mt.id = a.meeting_id
        join committees co on co.council_id = mt.council_id and co.id = mt.committee_id
        where a.council_id = ${c.id} and mt.date > current_date and mt.date <= ${until}::date and not mt.cancelled and not a.is_restricted
          and co.kind in ('council', 'cabinet', 'scrutiny', 'planning')
        order by mt.date, a.id limit 120`);
      sources.push(
        ...upcoming
          .filter((u) => !ROUTINE.test(u.title))
          .slice(0, 40)
          .map((u, i) => ({ id: `u${i + 1}`, kind: "upcoming" as const, title: u.title, url: null, meetingId: Number(u.m), date: u.d, text: `On the agenda of ${u.committee} (${u.kind}), ${u.d}: ${u.title}` })),
      );

      // c…: its open consultations.
      const consultations = await ctx.db.execute<{ url: string; title: string; closes: string | null; summary: string | null }>(sql`
        select url, title_en as title, closes::text as closes, summary_en as summary
        from consultations where source = ${c.id} and (open or closes >= current_date) order by closes nulls last limit 10`);
      sources.push(
        ...consultations.map((x, i) => ({
          id: `c${i + 1}`,
          kind: "consultation" as const,
          title: x.title,
          url: x.url,
          meetingId: null,
          date: x.closes,
          text: `${c.shortEn} consultation${x.closes ? ` closing ${x.closes}` : ""}: ${x.title}. ${(x.summary ?? "").slice(0, 300)}`,
        })),
      );

      let pence = 0;
      try {
        // Step 1: the council's own plans and position, from official sites only.
        const domain = new URL(c.website).hostname.replace(/^www\./, "");
        const ask = (domains: string[]) =>
          client.messages.create({
            model: MODEL,
            max_tokens: 4000,
            tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5, allowed_domains: domains }],
            messages: [
              {
                role: "user",
                content: `Find, for ${c.nameEn}: its current corporate plan or well-being objectives (its stated priorities); its budget position for this year and next, including any budget gap and council tax decisions; and any Audit Wales report on it from the past year. Write brief factual notes, citing each source.`,
              },
            ],
          });
        // Some council sites refuse the search tool: then official sources only.
        const research = await ask([domain, "audit.wales", "gov.wales"]).catch((err: Error) => {
          if (!/not accessible/i.test(err.message)) throw err;
          ctx.warn(`${c.id}: its website refuses the search tool; using Audit Wales and the Welsh Government only`);
          return ask(["audit.wales", "gov.wales"]);
        });
        pence += costPence(MODEL, research.usage);
        const web = new Map<string, Src>();
        for (const block of research.content) {
          if (block.type !== "text" || !block.citations) continue;
          for (const cit of block.citations) {
            if (cit.type !== "web_search_result_location") continue;
            const had = web.get(cit.url);
            if (had) {
              if (!had.text.includes(cit.cited_text)) had.text += ` … ${cit.cited_text}`;
            } else web.set(cit.url, { id: `w${web.size + 1}`, kind: "web", title: cit.title ?? cit.url, url: cit.url, meetingId: null, date: null, text: cit.cited_text });
          }
        }
        sources.push(...web.values());
        ctx.count("webSources", web.size);

        if (sources.length < 3) {
          ctx.log(`${c.id}: too few sources this month`);
          continue;
        }

        // Step 2: the overview, from the sources only.
        const listing = sources.map((s) => `[${s.id}] ${s.kind === "web" ? `${s.title} (${s.url}): ` : ""}${s.text}`).join("\n");
        const reply = await client.messages
          .stream({
            model: MODEL,
            max_tokens: 12000,
            system: SYSTEM,
            messages: [{ role: "user", content: `Council: ${c.nameEn}. Today is ${today}. Council records cover ${from} to today; the agenda covers the next six weeks.\n\nSources:\n${listing}` }],
            output_config: { format: { type: "json_schema", schema: SCHEMA } },
          })
          .finalMessage();
        pence += costPence(MODEL, reply.usage);
        const block = reply.content.find((b) => b.type === "text");
        const parsed = Output.safeParse(JSON.parse(block && block.type === "text" ? block.text : "{}"));
        if (!parsed.success) {
          problems.push(`${c.id}: reply didn't match the schema`);
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
        const content: CouncilBriefContent = {
          summary: check(parsed.data.summary),
          priorities: keep(parsed.data.priorities),
          recent: keep(parsed.data.recent),
          watch: keep(parsed.data.watch),
          sources: [],
          recordsFrom: from,
        };
        const used = new Set([content.summary, ...content.priorities, ...content.recent, ...content.watch].flatMap((p) => p?.sources ?? []));
        content.sources = sources.filter((s) => used.has(s.id)).map((s) => ({ id: s.id, kind: s.kind, title: s.title, url: s.url, meetingId: s.meetingId, date: s.date }));
        if (!content.summary && !content.priorities.length && !content.recent.length && !content.watch.length) {
          problems.push(`${c.id}: every point was dropped`);
          continue;
        }

        await ctx.db
          .insert(councilBriefs)
          .values({ councilId: c.id, month, content, model: MODEL, costPence: pence })
          .onConflictDoUpdate({ target: [councilBriefs.councilId, councilBriefs.month], set: { content, model: MODEL, costPence: pence, createdAt: new Date() } });
        ctx.count("written");
        ctx.touched.add("councils");
      } catch (err) {
        const msg = (err as Error).message;
        problems.push(`${c.id}: ${msg.slice(0, 200)}`);
        if (/credit balance/i.test(msg)) break;
      } finally {
        budget -= pence;
        ctx.count("pence", Math.round(pence));
      }
    }
    if (problems.length) throw new PartialFailure(problems.join("; "));
  },
};
