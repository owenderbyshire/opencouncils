/**
 * Local Development Plans: downloads each authority's written statement,
 * deposit plan and latest Annual Monitoring Report (data/curated/ldps.ts),
 * and reads the headline figures and allocated sites out of them. The model
 * is shown only the pages that could hold them, and each thing it reports
 * must quote words printed on the page it names, with the figure in the
 * quote; anything else is dropped. A document is read again only when it
 * changes or the reading does.
 *
 *   pnpm pipeline ldp [--authority cardiff] [--force] [--budget 300]
 */
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { LDPS } from "../../data/curated/ldps";
import { ldpDocuments, ldpFacts, ldpPoints, ldpSites } from "../../src/db/schema";
import { AI_MODEL_FAST, cachedSystem, costPence } from "../../src/lib/ai/config";
import { fetchBytes } from "../lib/http";
import { PartialFailure, type Job, type JobContext } from "../lib/job";
import { pdfText } from "../lib/pdf";
import { argNumber, argString, sha1 } from "../lib/util";
import {
  chunkPages,
  dedupeSites,
  FACT_KEYS,
  normalise,
  numberInQuote,
  numbersSupported,
  pagesWorthReading,
  pickFacts,
  quoteHasWords,
  quoteOnPage,
  splitPages,
  SUMMARY_TOPICS,
  topicPages,
  type FactCandidate,
  type SummaryTopic,
  type SiteCandidate,
} from "../sources/ldp";

/** Bump to read every document again. */
const READ_VERSION = 2;
/** Bump to write every plan's summary again. */
const SUMMARY_VERSION = 2;
const MODEL = process.env.LDP_MODEL || AI_MODEL_FAST;

type Kind = "adopted" | "deposit" | "amr";

const FACT_HELP: Record<Kind, string> = {
  adopted:
    "housing-requirement: the total number of new homes the plan says are needed over the whole plan period. housing-provision: the total number of homes the plan provides for, if it gives a separate figure (often the requirement plus a flexibility allowance). affordable-target: the total number of affordable homes the plan aims to deliver over the plan period. employment-land: the total hectares of land the plan allocates or provides for employment.",
  deposit:
    "housing-requirement: the total number of new homes the plan says are needed over the whole plan period. housing-provision: the total number of homes the plan provides for, if it gives a separate figure (often the requirement plus a flexibility allowance). affordable-target: the total number of affordable homes the plan aims to deliver over the plan period. employment-land: the total hectares of land the plan allocates or provides for employment.",
  amr:
    "completions-year: the number of new homes completed in the monitoring year the report covers. completions-total: the total number of homes completed since the start of the plan period. affordable-completions-year: the number of affordable homes completed in the monitoring year.",
};

function schemaFor(kind: Kind) {
  const keys = kind === "amr" ? FACT_KEYS.amr : FACT_KEYS.plan;
  return {
    type: "object",
    additionalProperties: false,
    required: ["facts", "sites"],
    properties: {
      facts: {
        type: "array",
        description: "Headline figures stated on these pages. Empty if none are.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "value", "page", "quote"],
          properties: {
            key: { type: "string", enum: [...keys] },
            value: { type: "number", description: "The figure as a plain number: 26350, not 26,350." },
            page: { type: "integer", description: "N from the '=== Page N ===' line of the page the quote is on." },
            quote: { type: "string", description: "The words on that page that state the figure, copied exactly, under 300 characters, including the figure." },
          },
        },
      },
      sites: {
        type: "array",
        description:
          kind === "amr"
            ? "Always empty for a monitoring report."
            : "Every site these pages allocate for development (housing, employment, mixed use, Gypsy and Traveller sites), as listed in the plan's policies or allocation tables. Not candidate sites, not sites with planning permission listed only as supply, not sites rejected. Empty if none are listed.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["ref", "name", "settlement", "use", "homes", "hectares", "page", "quote"],
          properties: {
            ref: { type: "string", description: "The plan's reference for the site, such as 'H1.12' or 'KSS3'. Empty if none." },
            name: { type: "string", description: "The site's name as the plan gives it." },
            settlement: { type: "string", description: "The town or village, if the plan gives one. Empty if not." },
            use: { type: "string", enum: ["housing", "employment", "mixed", "gypsy-traveller", "other"] },
            homes: { type: ["integer", "null"], description: "Homes allocated on the site, if the plan gives a number. Null if not." },
            hectares: { type: ["number", "null"], description: "Site area or employment land in hectares, if given. Null if not." },
            page: { type: "integer", description: "N from the '=== Page N ===' line of the page the site is listed on." },
            quote: { type: "string", description: "The line or table row listing the site, copied exactly, including the homes and hectares figures if given." },
          },
        },
      },
    },
  } as const;
}

const Output = z.object({
  facts: z.array(z.object({ key: z.string(), value: z.number(), page: z.number().int(), quote: z.string() })),
  sites: z.array(
    z.object({
      ref: z.string(),
      name: z.string(),
      settlement: z.string(),
      use: z.enum(["housing", "employment", "mixed", "gypsy-traveller", "other"]),
      homes: z.number().int().nullable(),
      hectares: z.number().nullable(),
      page: z.number().int(),
      quote: z.string(),
    }),
  ),
});

const SYSTEM = `You read pages from a Welsh Local Development Plan or its Annual Monitoring Report and pull out figures and allocated sites, exactly as printed. Report only what the pages state; never work out, add up or estimate a figure. Every quote must be copied word for word from the page you name. If the pages don't state something, leave it out.`;

interface Read {
  facts: FactCandidate[];
  sites: SiteCandidate[];
  pence: number;
  pages: number;
}

async function readDocument(ctx: JobContext, client: Anthropic, authority: string, kind: Kind, pages: string[]): Promise<Read> {
  const keys = new Set<string>(kind === "amr" ? FACT_KEYS.amr : FACT_KEYS.plan);
  const facts: FactCandidate[] = [];
  const sites: SiteCandidate[] = [];
  let pence = 0;
  const chunks = chunkPages(pages, pagesWorthReading(pages));
  for (const chunk of chunks) {
    const reply = await client.messages
      .stream({
        model: MODEL,
        max_tokens: 32000,
        system: cachedSystem(SYSTEM),
        messages: [{ role: "user", content: `Figures wanted: ${FACT_HELP[kind]}\n\n${chunk}` }],
        output_config: { format: { type: "json_schema", schema: schemaFor(kind) } },
      })
      .finalMessage();
    pence += costPence(MODEL, reply.usage);
    const block = reply.content.find((b) => b.type === "text");
    let parsed;
    try {
      parsed = Output.safeParse(JSON.parse(block && block.type === "text" ? block.text : "{}"));
    } catch {
      ctx.warn(`${authority} ${kind}: a reply was cut off (${reply.stop_reason})`);
      ctx.count("cutOff");
      continue;
    }
    if (!parsed.success) {
      ctx.count("badReplies");
      continue;
    }
    for (const f of parsed.data.facts) {
      const text = pages[f.page - 1];
      if (!keys.has(f.key) || !text || !quoteHasWords(f.quote) || !quoteOnPage(f.quote, text) || !numberInQuote(f.value, f.quote)) {
        ctx.count("factsDropped");
        continue;
      }
      facts.push({ key: f.key as FactCandidate["key"], value: f.value, page: f.page, quote: f.quote.trim() });
    }
    for (const s of parsed.data.sites) {
      const text = pages[s.page - 1];
      const ok =
        kind !== "amr" &&
        !!text &&
        s.name.trim().length > 2 &&
        quoteOnPage(s.quote, text) &&
        (s.homes === null || numberInQuote(s.homes, s.quote)) &&
        (s.hectares === null || numberInQuote(s.hectares, s.quote));
      if (!ok) {
        ctx.count("sitesDropped");
        const why = !text
          ? "noPage"
          : !quoteOnPage(s.quote, text)
            ? "quoteNotOnPage"
            : s.homes !== null && !numberInQuote(s.homes, s.quote)
              ? "homesNotInQuote"
              : s.hectares !== null && !numberInQuote(s.hectares, s.quote)
                ? "hectaresNotInQuote"
                : "other";
        ctx.count(`siteDropped ${why}`);
        continue;
      }
      sites.push({ ...s, ref: s.ref.trim(), name: s.name.trim(), settlement: s.settlement.trim(), quote: s.quote.trim() });
    }
  }
  return { facts, sites, pence, pages: pages.length };
}

const TOPIC_HELP: Record<SummaryTopic, string> = {
  strategy: "the plan's overall aim and strategy: what it wants for the area, how much growth it plans for, and where growth should go (which towns and villages)",
  housing: "new homes: how many, where, affordable housing requirements (what share of new homes must be affordable), and sites for Gypsies and Travellers",
  economy: "jobs and the economy: land for businesses and industry, tourism, the rural economy",
  "town-centres": "town and city centres and shopping: protecting centres, where new shops may go",
  environment: "the countryside, landscape, nature, green spaces and heritage: what is protected and how",
  climate: "climate change, renewable energy and flood risk",
  transport: "transport: roads, buses, rail, walking and cycling, parking",
  "welsh-language": "the Welsh language: how the plan protects it and what developers must show",
};

const SUMMARY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["points"],
  properties: {
    points: {
      type: "array",
      description: "Up to four points, the most important first. Empty if these pages say nothing substantive on the topic.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text_en", "text_cy", "policy", "page", "quote"],
        properties: {
          text_en: {
            type: "string",
            description:
              "One or two short, plain English sentences saying what the plan says, for someone who knows nothing about planning. Say 'The plan…'. Explain any planning term. British English, no em dashes. Use only figures that appear in the quote.",
          },
          text_cy: { type: "string", description: "The same point in natural Welsh, written for Welsh readers. Same figures." },
          policy: { type: "string", description: "The plan's policy reference the point rests on, exactly as printed (e.g. 'SP3' or 'H 4'). Empty if none." },
          page: { type: "integer", description: "N from the '=== Page N ===' line of the page the quote is on." },
          quote: { type: "string", description: "One sentence or phrase copied exactly from that page that the point rests on, under 200 characters. Copy it character for character; do not join text from different parts of the page." },
        },
      },
    },
  },
} as const;

const SummaryOutput = z.object({
  points: z.array(z.object({ text_en: z.string(), text_cy: z.string(), policy: z.string(), page: z.number().int(), quote: z.string() })),
});

const SUMMARY_SYSTEM = `You explain a Welsh Local Development Plan to members of the public in plain language. You are given pages from the plan and one topic. Pick what matters to someone living in the area: what will be built, where, what is protected, and what developers must do. Leave out how the plan was prepared or assessed (sustainability appraisal objectives, evidence studies, monitoring indicators). Say only what the pages say; never add, assume or estimate. Every point rests on a quote copied word for word from the page you name, and uses only figures that appear in that quote. Write in British English and natural Welsh.`;

interface SummaryPoint {
  topic: SummaryTopic;
  seq: number;
  textEn: string;
  textCy: string;
  policy: string | null;
  page: number;
  quote: string;
}

async function summariseDocument(ctx: JobContext, client: Anthropic, authority: string, kind: Kind, pages: string[]): Promise<{ points: SummaryPoint[]; pence: number }> {
  let pence = 0;
  const topics = Object.keys(SUMMARY_TOPICS) as SummaryTopic[];
  const results = await Promise.all(
    topics.map(async (topic) => {
      const text = topicPages(pages, SUMMARY_TOPICS[topic]);
      if (!text) return [] as SummaryPoint[];
      const reply = await client.messages
        .stream({
          model: MODEL,
          max_tokens: 8000,
          system: cachedSystem(SUMMARY_SYSTEM),
          messages: [{ role: "user", content: `Topic: ${TOPIC_HELP[topic]}.\n\nPages from the plan${kind === "deposit" ? " (a draft new plan, not yet adopted)" : ""}:\n\n${text}` }],
          output_config: { format: { type: "json_schema", schema: SUMMARY_SCHEMA } },
        })
        .finalMessage();
      pence += costPence(MODEL, reply.usage);
      const block = reply.content.find((b) => b.type === "text");
      let parsed;
      try {
        parsed = SummaryOutput.safeParse(JSON.parse(block && block.type === "text" ? block.text : "{}"));
      } catch {
        ctx.count("summaryCutOff");
        return [];
      }
      if (!parsed.success) return [];
      const out: SummaryPoint[] = [];
      for (const p of parsed.data.points.slice(0, 4)) {
        const page = pages[p.page - 1];
        const why = !page
          ? "noPage"
          : p.text_en.trim().length <= 20 || p.text_cy.trim().length <= 20 || /—/.test(p.text_en)
            ? "badText"
            : !quoteHasWords(p.quote)
              ? "quoteNoWords"
              : !quoteOnPage(p.quote, page)
                ? "quoteNotOnPage"
                : !numbersSupported(p.text_en, p.quote) || !numbersSupported(p.text_cy, p.quote)
                  ? "numberNotInQuote"
                  : null;
        if (why) {
          ctx.count(`dropped ${why}`);
          continue;
        }
        // A policy reference is kept only if it is printed on the page.
        const policy = p.policy.trim() && normalise(page).includes(normalise(p.policy.trim())) ? p.policy.trim() : null;
        out.push({ topic, seq: out.length, textEn: p.text_en.trim(), textCy: p.text_cy.trim(), policy, page: p.page, quote: p.quote.trim() });
      }
      return out;
    }),
  );
  return { points: results.flat(), pence };
}

export const ldpJob: Job = {
  name: "ldp",
  description: "Local Development Plans: headline figures and allocated sites, read from each authority's documents",
  async run(ctx) {
    if (!process.env.ANTHROPIC_API_KEY) {
      ctx.log("no ANTHROPIC_API_KEY; skipping");
      return;
    }
    const client = new Anthropic();
    const only = argString(ctx.args, "authority");
    const force = ctx.args.force === true;
    let budget = argNumber(ctx.args, "budget") ?? 300;
    const problems: string[] = [];
    // Plans change rarely: read once a week unless the list of documents changes.
    const listKey = sha1(JSON.stringify([READ_VERSION, SUMMARY_VERSION, LDPS.map((l) => [l.id, l.adopted.writtenStatement, l.replacement.deposit, l.amr.url])]));
    const last = await ctx.getState<{ at: string; list: string }>("ldp-read");
    if (!force && !only && last && last.list === listKey && Date.now() - Date.parse(last.at) < 7 * 86_400_000) {
      ctx.log(`read on ${last.at.slice(0, 10)}; next read after a week`);
      return;
    }

    for (const ldp of LDPS.filter((l) => !only || l.id === only)) {
      const docs: Array<{ kind: Kind; urls: string[] }> = [
        { kind: "adopted", urls: ldp.adopted.writtenStatement },
        { kind: "deposit", urls: ldp.replacement.deposit },
        { kind: "amr", urls: ldp.amr.url ? [ldp.amr.url] : [] },
      ];
      for (const { kind, urls } of docs) {
        if (budget <= 0) break;
        // Documents no longer listed: forget them and what was read from them.
        const listed = new Set(urls);
        const held = await ctx.db.select({ url: ldpDocuments.url }).from(ldpDocuments).where(and(eq(ldpDocuments.authority, ldp.id), eq(ldpDocuments.kind, kind)));
        const stale = held.map((h) => h.url).filter((u) => !listed.has(u));
        if (stale.length) {
          await ctx.db.delete(ldpDocuments).where(and(eq(ldpDocuments.authority, ldp.id), eq(ldpDocuments.kind, kind), inArray(ldpDocuments.url, stale)));
          await ctx.db.delete(ldpFacts).where(and(eq(ldpFacts.authority, ldp.id), eq(ldpFacts.kind, kind), inArray(ldpFacts.url, stale)));
          await ctx.db.delete(ldpSites).where(and(eq(ldpSites.authority, ldp.id), eq(ldpSites.kind, kind), inArray(ldpSites.url, stale)));
          await ctx.db.delete(ldpPoints).where(and(eq(ldpPoints.authority, ldp.id), eq(ldpPoints.kind, kind), inArray(ldpPoints.url, stale)));
          ctx.touched.add("planning");
        }
        for (const url of urls) {
          const got = await fetchBytes(url);
          const isPdf = got.ok && got.bytes[0] === 0x25 && got.bytes[1] === 0x50;
          if (!got.ok || !isPdf) {
            const problem = got.ok ? "not a PDF" : got.error.slice(0, 200);
            problems.push(`${ldp.id} ${kind}: ${problem} (${url})`);
            await ctx.db
              .insert(ldpDocuments)
              .values({ authority: ldp.id, kind, url, problem })
              .onConflictDoUpdate({ target: [ldpDocuments.authority, ldpDocuments.kind, ldpDocuments.url], set: { problem, fetchedAt: new Date() } });
            continue;
          }
          const hash = sha1(Buffer.from(got.bytes).toString("base64"));
          const [had] = await ctx.db.select().from(ldpDocuments).where(and(eq(ldpDocuments.authority, ldp.id), eq(ldpDocuments.kind, kind), eq(ldpDocuments.url, url)));
          const sameDoc = !force && had?.hash === hash && !had.problem;
          const needRead = !(sameDoc && had?.readVersion === READ_VERSION);
          const needSummary = kind !== "amr" && !(sameDoc && had?.summaryVersion === SUMMARY_VERSION);
          if (!needRead && !needSummary) {
            ctx.count("unchanged");
            continue;
          }
          let pages: string[];
          try {
            pages = splitPages(await pdfText(got.bytes));
          } catch (e) {
            problems.push(`${ldp.id} ${kind}: ${(e as Error).message}`);
            continue;
          }
          if (pages.join("").replace(/\s/g, "").length < 2000) {
            problems.push(`${ldp.id} ${kind}: no text in the PDF (scanned?) (${url})`);
            continue;
          }
          if (needSummary) {
            try {
              const prose = splitPages(await pdfText(got.bytes, { layout: false }));
              const sum = await summariseDocument(ctx, client, ldp.id, kind, prose.length === pages.length ? prose : pages);
              budget -= sum.pence;
              await ctx.db.transaction(async (tx) => {
                await tx.delete(ldpPoints).where(and(eq(ldpPoints.authority, ldp.id), eq(ldpPoints.kind, kind), eq(ldpPoints.url, url)));
                if (sum.points.length) await tx.insert(ldpPoints).values(sum.points.map((p) => ({ ...p, authority: ldp.id, kind, url })));
                await tx
                  .insert(ldpDocuments)
                  .values({ authority: ldp.id, kind, url, hash, summaryVersion: SUMMARY_VERSION })
                  .onConflictDoUpdate({ target: [ldpDocuments.authority, ldpDocuments.kind, ldpDocuments.url], set: { summaryVersion: SUMMARY_VERSION } });
              });
              ctx.count("summaries");
              ctx.count("points", sum.points.length);
              ctx.count("pence", Math.round(sum.pence));
              ctx.touched.add("planning");
            } catch (e) {
              const msg = (e as Error).message;
              problems.push(`${ldp.id} ${kind} summary: ${msg.slice(0, 200)}`);
              if (/credit balance/i.test(msg)) throw new PartialFailure(problems.join("; "));
            }
          }
          if (!needRead) continue;
          let read: Read;
          try {
            read = await readDocument(ctx, client, ldp.id, kind, pages);
          } catch (e) {
            const msg = (e as Error).message;
            problems.push(`${ldp.id} ${kind}: ${msg.slice(0, 200)}`);
            if (/credit balance/i.test(msg)) throw new PartialFailure(problems.join("; "));
            continue;
          }
          budget -= read.pence;
          const facts = pickFacts(read.facts);
          const sites = dedupeSites(read.sites);
          await ctx.db.transaction(async (tx) => {
            await tx.delete(ldpFacts).where(and(eq(ldpFacts.authority, ldp.id), eq(ldpFacts.kind, kind), eq(ldpFacts.url, url)));
            await tx.delete(ldpSites).where(and(eq(ldpSites.authority, ldp.id), eq(ldpSites.kind, kind), eq(ldpSites.url, url)));
            if (facts.length)
              await tx.insert(ldpFacts).values(facts.map((f) => ({ authority: ldp.id, kind, key: f.key, value: f.value, url, page: f.page, quote: f.quote, mentions: f.mentions })));
            if (sites.length)
              await tx.insert(ldpSites).values(
                sites.map((s) => ({
                  authority: ldp.id,
                  kind,
                  ref: s.ref || null,
                  name: s.name,
                  settlement: s.settlement || null,
                  use: s.use,
                  homes: s.homes,
                  hectares: s.hectares,
                  url,
                  page: s.page,
                  quote: s.quote,
                })),
              );
            await tx
              .insert(ldpDocuments)
              .values({ authority: ldp.id, kind, url, hash, pageCount: read.pages, readVersion: READ_VERSION, costPence: read.pence, problem: null })
              .onConflictDoUpdate({
                target: [ldpDocuments.authority, ldpDocuments.kind, ldpDocuments.url],
                set: { hash, pageCount: read.pages, readVersion: READ_VERSION, costPence: read.pence, problem: null, fetchedAt: new Date() },
              });
          });
          ctx.count("documentsRead");
          ctx.count("facts", facts.length);
          ctx.count("sites", sites.length);
          ctx.count("pence", Math.round(read.pence));
          ctx.touched.add("planning");
        }
      }
    }
    if (budget <= 0) ctx.warn("Run budget reached; the rest are read next time");
    else if (!only) await ctx.setState("ldp-read", { at: new Date().toISOString(), list: listKey });
    if (problems.length) throw new PartialFailure(problems.join("; "));
  },
};

/** Prints what has been read, for checking by hand. */
export const ldpReportJob: Job = {
  name: "ldp-report",
  description: "Prints the figures and sites read from development plans",
  async run(ctx) {
    const facts = await ctx.db.select().from(ldpFacts);
    for (const f of facts.sort((a, b) => (a.authority + a.kind + a.key).localeCompare(b.authority + b.kind + b.key)))
      ctx.log(`FACT ${f.authority} ${f.kind} ${f.key} = ${f.value} (p${f.page}, x${f.mentions}) «${f.quote.slice(0, 160)}»`);
    const sites = await ctx.db.select().from(ldpSites);
    const by = new Map<string, typeof sites>();
    for (const s of sites) by.set(`${s.authority} ${s.kind}`, [...(by.get(`${s.authority} ${s.kind}`) ?? []), s]);
    for (const [k, list] of [...by].sort()) {
      const homes = list.filter((s) => s.homes !== null).length;
      ctx.log(`SITES ${k}: ${list.length} (${homes} with homes) uses=${[...new Set(list.map((s) => s.use))].join(",")}`);
      for (const s of list.slice(0, 4)) ctx.log(`  ${s.ref ?? "-"} | ${s.name} | ${s.settlement ?? ""} | ${s.use} | ${s.homes ?? ""} | ${s.hectares ?? ""} | p${s.page}`);
    }
    if (ctx.args.dump === true) {
      for (const f of facts) ctx.log(`ROWFACT ${JSON.stringify(f)}`);
      for (const s of sites) ctx.log(`ROWSITE ${JSON.stringify(s)}`);
      for (const p of await ctx.db.select().from(ldpPoints)) ctx.log(`ROWPOINT ${JSON.stringify(p)}`);
    }
    for (const p of await ctx.db.select().from(ldpPoints)) ctx.log(`POINT ${p.authority} ${p.kind} ${p.topic} [${p.policy ?? "-"} p${p.page}] ${p.textEn} || ${p.textCy}`);
    for (const d of await ctx.db.select().from(ldpDocuments)) ctx.log(`DOC ${d.authority} ${d.kind} pages=${d.pageCount} ${d.problem ?? "ok"} ${d.url.slice(0, 90)}`);
  },
};

/** Lists council meeting papers about development plans, to find documents missing from the plan list. */
export const ldpFindJob: Job = {
  name: "ldp-find",
  description: "Lists meeting papers that look like development plan documents",
  async run(ctx) {
    const rows = await ctx.db.execute<{ c: string; d: string; t: string; u: string; n: number | null; item: string | null }>(sql`
      select d.council_id as c, m.date::text as d, d.title as t, d.url as u, length(d.text) as n, i.title as item
      from documents d
      join meetings m on m.council_id = d.council_id and m.id = d.meeting_id
      left join agenda_items i on i.council_id = d.council_id and i.id = d.agenda_item_id
      where m.date > current_date - 900
        and (d.title ~* '(annual monitoring|\\mAMR\\M|written statement|deposit plan|local development plan|delivery agreement)'
          or i.title ~* '(annual monitoring|\\mAMR\\M|local development plan|\\mR?LDP\\M)')
      order by d.council_id, m.date desc`);
    for (const r of rows) ctx.log(`DOCFIND ${r.c} ${r.d} [${r.n ?? "no text"}] ${r.t} || ${r.item ?? ""} || ${r.u}`);
  },
};

/** Prints pages of documents, to check what they are before listing them. */
export const ldpPeekJob: Job = {
  name: "ldp-peek",
  description: "Prints pages of documents given with --url (comma-separated); --pages 25-28 picks pages",
  async run(ctx) {
    const [from, to] = (argString(ctx.args, "pages") ?? "1-3").split("-").map(Number);
    for (const url of (argString(ctx.args, "url") ?? "").split(",").filter(Boolean)) {
      const got = await fetchBytes(url);
      if (!got.ok) {
        ctx.log(`PEEK ${url}: ${got.error}`);
        continue;
      }
      const layout = ctx.args.layout === true;
      const pages = splitPages(await pdfText(got.bytes, { layout }).catch((e: Error) => `not a PDF: ${e.message}`));
      ctx.log(`PEEK ${url}: ${pages.length} pages`);
      for (let n = from; n <= Math.min(to || from, pages.length); n++) ctx.log(`PAGE ${n}\n${layout ? pages[n - 1] : pages[n - 1].replace(/\s+/g, " ").slice(0, 1500)}`);
    }
  },
};
