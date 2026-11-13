/**
 * Reads three kinds of paper each council publishes and keeps the checked
 * facts from each:
 *
 *   risks       its latest corporate or strategic risk register
 *   budget      the report that set this year's budget (February or March,
 *               full Council or Cabinet)
 *   monitoring  its latest in-year report on how the budget is going
 *
 * For each kind it picks one agenda item and reads its papers (the covering
 * report and appendices, up to four). Every risk and figure must come with
 * the words it rests on, which must be on the page it names; a figure must
 * be written in those words exactly as given, and the number is worked out
 * from that wording here, never taken from the model. Anything that fails a
 * check is dropped. A kind is read again only when a newer item appears.
 *
 *   pnpm pipeline council-papers --survey            list the items that would be read
 *   pnpm pipeline council-papers [--council cardiff] [--kind risks,budget,monitoring] [--force] [--show]
 */
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { ACTIVE_COUNCILS } from "../../data/curated/councils";
import { councilPapers } from "../../src/db/schema";
import { AI_MODEL, costPence } from "../../src/lib/ai/config";
import { parseFigure, type BudgetKey, type CouncilPaperKind, type CouncilRisk, type MoneyContent, type MoneyFact, type PaperRef, type RisksContent } from "../../src/lib/council-papers";
import { riskThemesOf } from "../../src/lib/risk-themes";
import { fetchBytes } from "../lib/http";
import { PartialFailure, type Job, type JobContext } from "../lib/job";
import { pdfText } from "../lib/pdf";
import { argNumber, argString } from "../lib/util";
import { normalise, numbersSupported, quoteOnPage, splitPages } from "../sources/ldp";

const MODEL = process.env.PAPERS_MODEL || AI_MODEL;
const MAX_DOCS = 4;
const MAX_CHARS = 150_000;

/** Committees whose papers aren't the council's own business. */
const NOT_THE_COUNCIL = "(pension|joint committee|\\mCJC\\M|corporate joint|public services board|\\mPSB\\M|growth deal|city deal|crematorium|fire (and|&) rescue|port health|coroner)";
/** Papers on one item that aren't worth reading. */
const SKIP_DOC = "(minutes|agenda frontsheet|public reports pack|equality|impact assessment|\\mEIA\\M|integrated impact|\\mIIA\\M|well-?being of future generations|WBFGA|consultation responses?|heat ?map|scrutiny rec)";

const KIND_RULES: Record<CouncilPaperKind, { months: number; committees: string; match: string; exclude: string; skipDoc: string; order: string }> = {
  risks: {
    months: 14,
    committees: "('council', 'cabinet', 'scrutiny', 'regulatory', 'other')",
    // The item's own title, or a paper on it titled as the corporate or strategic register.
    match: "(i.title ~* '(risk register|corporate risk|strategic risk|risk management\\W+(annual\\W+)?(update|report)|business risk)' or i.docs ~* '(corporate|strategic) risk register')",
    exclude: "(information risk|climate change risk|fire safety|connect to work|programme risk|project risk|treasury|growth deal)",
    skipDoc: "(heat ?map|scoring matrix|probability and impact|presentation)",
    order: "(i.title ~* '((corporate|strategic|business) risk|risk register|risk management update)') desc, i.date desc",
  },
  budget: {
    months: 15,
    committees: "('council', 'cabinet')",
    match: "(i.title ~* '(budget|council tax (resolution|setting|20)|medium[- ]term financial)')",
    exclude: "(monitoring|outturn|quarter|finance report|^capital|housing revenue account|\\mHRA\\M|treasury|consultation|schools? budget forum|fees and charges|financial update|premium|discretionary|discount|tax base|reduction scheme|foster|exception|relief|time to talk)",
    skipDoc: "(housing revenue|\\mHRA\\M|capital (strategy|programme)|treasury|precepts|special items)",
    // Set in February or March by full Council: its budget report, then its council tax resolution, then its financial strategy; Cabinet's only where Council's isn't held.
    order: `(extract(month from i.date) between 1 and 3) desc, (i.kind = 'council') desc,
      (case when i.title ~* '(revenue budget|budget (proposals|setting|report|20)|council fund budget|final budget|budget and council tax|budgets? for 20|20[0-9][0-9][-/]?[0-9]* budget)' then 1
            when i.title ~* 'council tax (resolution|setting)' then 2 when i.title ~* 'medium[- ]term financial' then 3 else 4 end),
      i.date desc`,
  },
  monitoring: {
    months: 8,
    committees: "('council', 'cabinet', 'scrutiny', 'regulatory')",
    match: "(i.title ~* '(revenue (budget )?monitoring|budget monitoring|financial (monitoring|performance|position|forecast)|revenue (forecast|budget update)|budget update|budget [^/]{0,25}monitoring|revenue outturn|financial outturn|finance report|performance,? risk and finance)')",
    exclude: "(pension|treasury|grants?\\M|disabled facilities|directorate|schools|education|social services|scrutiny recommendations|^capital|housing revenue account budget|\\mHRA\\M budget)",
    skipDoc: "(housing revenue|\\mHRA\\M|capital|schools? delegated|treasury|scrutiny rec)",
    // In-year reports before last year's outturn; Cabinet's copy before a scrutiny committee's; newest first.
    order: "(i.title ~* 'outturn' and i.title !~* 'forecast') asc, (i.kind = 'cabinet') desc, i.date desc",
  },
};

export interface ChosenItem {
  meetingId: number;
  itemId: number | null;
  date: string;
  committee: string;
  kind: string;
  title: string;
  documents: PaperRef[];
}

/** The agenda item a council's facts of one kind would be read from, and its papers. */
export async function chooseItem(ctx: JobContext, councilId: string, kind: CouncilPaperKind, limit = 1): Promise<ChosenItem[]> {
  const r = KIND_RULES[kind];
  const found = await ctx.db.execute<{ meetingId: number; itemId: number; date: string; committee: string; kind: string; title: string; documents: PaperRef[] }>(sql`
    with items as (
      select a.meeting_id as "meetingId", a.id as "itemId", m.date, c.name_en as committee, c.kind, a.title,
        coalesce((select string_agg(d.title, ' ') from documents d where d.council_id = a.council_id and d.agenda_item_id = a.id), '') as docs
      from agenda_items a
      join meetings m on m.council_id = a.council_id and m.id = a.meeting_id
      join committees c on c.council_id = m.council_id and c.id = m.committee_id
      where a.council_id = ${councilId} and not m.cancelled and not a.is_restricted and m.date <= current_date
        and m.date >= current_date - (${r.months} || ' months')::interval
        and c.kind in ${sql.raw(r.committees)} and c.name_en !~* ${NOT_THE_COUNCIL}
    )
    select i."meetingId", i."itemId", i.date::text as date, i.committee, i.kind, i.title,
      coalesce((select json_agg(json_build_object('id', d.id, 'title', d.title, 'url', d.url) order by d.id)
        from documents d where d.council_id = ${councilId} and d.agenda_item_id = i."itemId" and d.title !~* ${SKIP_DOC} and d.title !~* ${r.skipDoc}), '[]') as documents
    from items i
    where ${sql.raw(r.match)} and i.title !~* ${r.exclude}
      and exists (select 1 from documents d where d.council_id = ${councilId} and d.agenda_item_id = i."itemId" and d.title !~* ${SKIP_DOC} and d.title !~* ${r.skipDoc})
    order by ${sql.raw(r.order)}
    limit ${limit}`);
  return found.map((f) => ({ ...f, documents: (f.documents ?? []).slice(0, MAX_DOCS) }));
}

/**
 * Each paper's pages. Read afresh in reading order where the paper downloads, because the text the meetings job
 * stores keeps the page layout, which runs a table's columns together and splits its sentences. The stored text
 * is the fallback for councils whose papers don't download from here.
 */
async function readPapers(ctx: JobContext, councilId: string, docs: PaperRef[]): Promise<string[][]> {
  const out: string[][] = [];
  for (const d of docs) {
    let text: string | null = null;
    const b = await fetchBytes(d.url);
    if (b.ok && b.bytes[0] === 0x25 && b.bytes[1] === 0x50) {
      try {
        text = await pdfText(b.bytes, { layout: false });
        ctx.count("papersRead");
      } catch {
        ctx.count("pdfFailures");
      }
    }
    if (!text) {
      const [held] = await ctx.db.execute<{ text: string | null }>(sql`select text from documents where council_id = ${councilId} and id = ${d.id}`);
      text = held?.text ?? null;
      ctx.count(text ? "papersFromStore" : "papersUnreadable");
    }
    out.push(text ? splitPages(text) : []);
  }
  return out;
}

/** The papers as one listing for the model, each page marked "[paper N, page P]", within a size limit. */
function listing(papers: string[][], keep: (page: string) => boolean): string {
  const parts: string[] = [];
  let size = 0;
  papers.forEach((pages, d) =>
    pages.forEach((p, i) => {
      if (size > MAX_CHARS || !p.trim() || !keep(p)) return;
      const chunk = `[paper ${d + 1}, page ${i + 1}]\n${p.trim()}\n`;
      size += chunk.length;
      parts.push(chunk);
    }),
  );
  return parts.join("\n");
}

const CITE = {
  paper: { type: "integer", description: "The paper number, from the [paper N, page P] marks." },
  page: { type: "integer", description: "The page number, from the marks." },
  quote: { type: "string", description: "Words copied exactly from that page, 8 to 40 words, that show this. No paraphrase." },
} as const;

const RISK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["asOf", "risks"],
  properties: {
    asOf: { type: ["string", "null"], description: "The date the register is as at, YYYY-MM-DD, if the paper says; otherwise null." },
    risks: {
      type: "array",
      description: "Every risk on the council's corporate or strategic register, once each. Leave out risks of other bodies and of single projects.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "summaryEn", "summaryCy", "rating", "trend", "paper", "page", "quote"],
        properties: {
          title: { type: "string", description: "The risk's name or short title exactly as the paper gives it." },
          summaryEn: { type: "string", description: "One plain English sentence on what could go wrong and why it matters, for someone who knows nothing about councils. No jargon, no em dashes, no opinion. Any figure must be in the quote." },
          summaryCy: { type: "string", description: "The same sentence in natural Welsh, written for Welsh readers. Same figures." },
          rating: { type: ["string", "null"], description: "The current (residual) rating exactly as written in the paper (e.g. 'High', 'Red', '20'), or null if none is given." },
          trend: { anyOf: [{ type: "string", enum: ["up", "steady", "down"] }, { type: "null" }], description: "Only if the paper says whether the risk is rising, unchanged or falling." },
          ...CITE,
        },
      },
    },
  },
} as const;

const MONEY_KEYS: Record<"budget" | "monitoring", Partial<Record<BudgetKey, string>>> = {
  budget: {
    net_budget: "The council's net revenue budget for the year (one figure, in pounds).",
    council_tax_rise: "The percentage rise in council tax for the year (the council's own part, not police or community councils).",
    band_d: "The council's own Band D council tax for the year, in pounds.",
    savings: "The total savings, cuts or efficiencies built into the year's budget, in pounds.",
    reserves_used: "Reserves used to balance the year's budget, in pounds.",
    settlement_change: "The percentage change in the council's Welsh Government settlement (revenue support) for the year.",
    gap_future: "A budget gap or shortfall the council forecasts for a future year, in pounds, with that year. Up to three years.",
  },
  monitoring: {
    forecast_variance: "The forecast overspend or underspend for the whole council for the year, in pounds, with its direction. Where the report gives a figure before and after mitigations or use of reserves, give the net figure it treats as the position.",
    service_variance: "The forecast overspend or underspend of one service or directorate, in pounds, with its direction and the service's name. Only the largest three overspends, and only top-level services or directorates as the report's summary table lists them, never a part of one already given.",
  },
};

function moneySchema(kind: "budget" | "monitoring") {
  const keys = Object.keys(MONEY_KEYS[kind]);
  return {
    type: "object",
    additionalProperties: false,
    required: ["year", "period", "facts"],
    properties: {
      year: { type: ["string", "null"], description: "The financial year the budget is for, or being monitored, as 2026-27." },
      period: { type: ["string", "null"], description: kind === "monitoring" ? "The point in the year the report covers, as it says (e.g. 'Quarter 1', 'Month 5')." : "Always null." },
      facts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "valueText", "scale", "year", "direction", "service", "paper", "page", "quote"],
          properties: {
            key: { type: "string", enum: keys, description: keys.map((k) => `${k}: ${MONEY_KEYS[kind][k as BudgetKey]}`).join(" ") },
            valueText: { type: "string", description: "The figure exactly as written in the quote (e.g. '£12.3m', '£1,234,000', '4.5%', or '462,817' from a table in £000)." },
            scale: { anyOf: [{ type: "string", enum: ["thousands", "millions"] }, { type: "null" }], description: "Only for a bare number with no £ sign, from a table whose heading says its figures are in £000 (thousands) or £m (millions). Otherwise null." },
            year: { type: ["string", "null"], description: "The financial year it is for, as 2026-27, where it matters (always for gap_future)." },
            direction: { anyOf: [{ type: "string", enum: ["over", "under"] }, { type: "null" }], description: "For a variance: overspend or underspend." },
            service: { type: ["string", "null"], description: "For service_variance: the service as the paper names it." },
            ...CITE,
          },
        },
      },
    },
  } as const;
}

const Cited = z.object({ paper: z.number().int(), page: z.number().int(), quote: z.string() });
const RiskOut = z.object({
  asOf: z.string().nullable(),
  risks: z.array(Cited.extend({ title: z.string(), summaryEn: z.string(), summaryCy: z.string(), rating: z.string().nullable(), trend: z.enum(["up", "steady", "down"]).nullable() })),
});
const MoneyOut = z.object({
  year: z.string().nullable(),
  period: z.string().nullable(),
  facts: z.array(Cited.extend({ key: z.string(), valueText: z.string(), scale: z.enum(["thousands", "millions"]).nullable(), year: z.string().nullable(), direction: z.enum(["over", "under"]).nullable(), service: z.string().nullable() })),
});

const SYSTEM = `You read a Welsh council's own committee papers and pull out facts for members of the public. Copy, never estimate: every fact names the paper and page it is on and quotes the exact words that show it. If the papers don't give something, leave it out. British English, plain words, no opinion.`;

/**
 * Where a quote is: the page named, or failing that the one page of the same paper it is on (page marks can be
 * one out where a table runs over). The page number and text, or null when the words aren't in the paper.
 */
function citedPage(papers: string[][], c: { paper: number; page: number; quote: string }): { page: number; text: string } | null {
  const pages = papers[c.paper - 1];
  if (!pages) return null;
  const named = pages[c.page - 1];
  if (named && quoteOnPage(c.quote, named)) return { page: c.page, text: named };
  const found = pages.map((t, i) => (quoteOnPage(c.quote, t) ? i : -1)).filter((i) => i >= 0);
  return found.length === 1 ? { page: found[0] + 1, text: pages[found[0]] } : null;
}

function checkRisks(ctx: JobContext, papers: string[][], out: z.infer<typeof RiskOut>): RisksContent {
  const seen = new Set<string>();
  const risks: CouncilRisk[] = [];
  for (const r of out.risks) {
    const where = citedPage(papers, r);
    const page = where?.text ?? null;
    const key = normalise(r.title);
    // Letters and digits only, so "B1 –Likely" matches "B1 – Likely".
    const bare = (x: string) => normalise(x).replace(/[^\p{L}\p{N}]+/gu, "");
    const ratingOk = !r.rating || bare(page ?? "").includes(bare(r.rating));
    // A rating that isn't on the page as written is left out; the risk itself still counts.
    if (!ratingOk) ctx.count("ratingsLeftOut");
    const ok =
      page &&
      key.length > 3 &&
      normalise(page).includes(key.slice(0, Math.min(key.length, 30))) &&
      !seen.has(key) &&
      r.summaryEn.trim().length > 20 &&
      r.summaryCy.trim().length > 20 &&
      !/—/.test(r.summaryEn + r.summaryCy) &&
      numbersSupported(r.summaryEn, r.quote) &&
      numbersSupported(r.summaryCy, r.quote);
    if (!ok) {
      const why = !page ? "riskQuoteNotFound" : seen.has(key) ? "riskDuplicate" : "riskDropped";
      ctx.count(why);
      if (ctx.args.debug === true) ctx.log(`DROP ${why} p${r.paper}.${r.page} title "${r.title}" rating "${r.rating}" quote "${r.quote}"`);
      continue;
    }
    seen.add(key);
    risks.push({
      title: r.title.trim(),
      summaryEn: r.summaryEn.trim(),
      summaryCy: r.summaryCy.trim(),
      rating: ratingOk ? r.rating?.trim() || null : null,
      trend: r.trend,
      // From the council's own words, never from the summary written here.
      themes: riskThemesOf(`${r.title} ${r.quote}`),
      doc: r.paper - 1,
      page: where!.page,
      quote: r.quote.trim(),
    });
  }
  const asOf = out.asOf && /^\d{4}-\d{2}-\d{2}$/.test(out.asOf) ? out.asOf : null;
  return { asOf, risks };
}

const YEAR = /^20\d\d-\d\d$/;
/** Words one of which must come just before a bare table figure, so the figure is tied to its row. */
const LABELS: Partial<Record<BudgetKey, string>> = {
  net_budget: "budget|requirement|net|total",
  savings: "saving|savings|reduction|reductions|efficiency|efficiencies|cuts",
  reserves_used: "reserve|reserves|balances",
  gap_future: "gap|shortfall|deficit",
  forecast_variance: "variance|overspend|underspend|deficit|surplus|outturn|position|total",
};

/** One of the label words (or the service's name) is among the six words before the figure in the quote. */
export function labelBefore(quote: string, valueText: string, label: string): boolean {
  const q = normalise(quote);
  const at = q.indexOf(normalise(valueText));
  if (at < 0 || !label.trim()) return false;
  const before = q.slice(0, at).split(/\s+/).filter(Boolean).slice(-6).join(" ");
  const words = label.includes("|") ? label.split("|") : normalise(label).split(/\s+/).filter((w) => w.length > 2);
  return words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(before));
}

const THOUSANDS = /£\s*'?000s?\b|£k\b|£\s*thousands?|\(£000\)/i;
const MILLIONS = /£\s*m\b|£\s*millions?\b|\(£m\)/i;

/** A bare figure ("462,817", "(1,204)", "12.3") from a table in thousands or millions of pounds, in pounds. */
export function parseScaled(text: string, scale: "thousands" | "millions"): { value: number; unit: "gbp" } | null {
  const m = text.replace(/[()\s]/g, "").match(/^[-−]?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/);
  if (!m) return null;
  const n = Number(`${m[1].replace(/,/g, "")}${m[2] ? `.${m[2]}` : ""}`);
  return { value: Math.round(n * (scale === "thousands" ? 1e3 : 1e6)), unit: "gbp" };
}

function checkMoney(ctx: JobContext, kind: "budget" | "monitoring", papers: string[][], out: z.infer<typeof MoneyOut>): MoneyContent {
  const allowed = new Set(Object.keys(MONEY_KEYS[kind]));
  const facts: MoneyFact[] = [];
  for (const f of out.facts) {
    const where = citedPage(papers, f);
    const page = where?.text ?? null;
    // A bare number from a table headed £000 or £m counts only when the page shows that heading.
    const scaleOk = !f.scale || (page !== null && (f.scale === "thousands" ? THOUSANDS : MILLIONS).test(page));
    const labelled = !f.scale || labelBefore(f.quote, f.valueText, f.key === "service_variance" ? (f.service ?? "") : LABELS[f.key as BudgetKey] ?? "");
    const fig = scaleOk && labelled ? (f.scale ? parseScaled(f.valueText, f.scale) : parseFigure(f.valueText)) : null;
    const inQuote = normalise(f.quote).includes(normalise(f.valueText));
    const pctKey = f.key === "council_tax_rise" || f.key === "settlement_change";
    const unitOk = fig && (pctKey ? fig.unit === "pct" : fig.unit === "gbp");
    const variance = f.key === "forecast_variance" || f.key === "service_variance";
    const ok = allowed.has(f.key) && page && fig && inQuote && unitOk && (!variance || f.direction) && (f.key !== "service_variance" || f.service) && (f.key !== "gap_future" || (f.year && YEAR.test(f.year)));
    if (!ok) {
      const why = !page ? "figureQuoteNotFound" : !labelled ? "figureUnlabelled" : !fig ? "figureUnreadable" : !inQuote ? "figureNotInQuote" : "figureDropped";
      ctx.count(why);
      if (ctx.args.debug === true) ctx.log(`DROP ${why} ${f.key} p${f.paper}.${f.page} value "${f.valueText}" quote "${f.quote}"`);
      continue;
    }
    facts.push({
      key: f.key as BudgetKey,
      valueText: f.valueText.trim(),
      value: fig.value,
      unit: fig.unit,
      year: f.year && YEAR.test(f.year) ? f.year : null,
      direction: variance ? f.direction : null,
      service: f.key === "service_variance" ? (f.service?.trim() ?? null) : null,
      doc: f.paper - 1,
      page: where!.page,
      quote: f.quote.trim(),
      scale: f.scale ?? null,
    });
  }
  // One figure per key (and year, and service): where papers disagree, keep none, so nothing contradictory is shown.
  const groups = new Map<string, MoneyFact[]>();
  for (const f of facts) {
    const k = `${f.key}|${f.year ?? ""}|${f.service ? normalise(f.service) : ""}`;
    groups.set(k, [...(groups.get(k) ?? []), f]);
  }
  const kept: MoneyFact[] = [];
  for (const [, g] of groups) {
    const values = new Set(g.map((f) => `${f.value}|${f.direction ?? ""}`));
    if (values.size === 1) kept.push(g[0]);
    else ctx.count("figuresConflicting");
  }
  const year = out.year && YEAR.test(out.year) ? out.year : null;
  return { year, period: kind === "monitoring" ? (out.period?.trim() || null) : null, facts: kept };
}

const MONEY_PAGE = /£|per ?cent|%/i;

export const councilPapersJob: Job = {
  name: "council-papers",
  description: "Risks and budget figures from each council's own papers, checked against the text",
  async run(ctx) {
    const only = argString(ctx.args, "council");
    const kinds = (argString(ctx.args, "kind")?.split(",") ?? ["risks", "budget", "monitoring"]) as CouncilPaperKind[];
    const councils = ACTIVE_COUNCILS.filter((x) => !only || x.id === only);

    if (ctx.args.survey === true) {
      for (const c of councils)
        for (const k of kinds) {
          const found = await chooseItem(ctx, c.id, k, 3);
          if (!found.length) ctx.log(`SURVEY ${c.id} ${k} (none)`);
          for (const f of found) ctx.log(`SURVEY ${c.id} ${k} ${f.date} [${f.committee}] "${f.title.slice(0, 80)}" papers: ${f.documents.map((d) => d.title.slice(0, 40)).join(" | ")}`);
        }
      return;
    }
    if (ctx.args.show === true) {
      const rows = await ctx.db.execute<Record<string, unknown>>(sql`
        select council_id, kind, meeting_id, item_id, date::text as date, committee, title, documents, content from council_papers
        where (${only ?? null}::text is null or council_id = ${only ?? null}) order by council_id, kind`);
      for (const r of rows) ctx.log(`PAPER ${JSON.stringify(r)}`);
      return;
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      ctx.log("no ANTHROPIC_API_KEY; skipping");
      return;
    }

    const client = new Anthropic();
    let budget = argNumber(ctx.args, "budget") ?? 1500;
    const problems: string[] = [];
    for (const c of councils) {
      for (const kind of kinds) {
        if (budget <= 0) break;
        const [item] = await chooseItem(ctx, c.id, kind);
        if (!item || !item.documents.length) {
          ctx.count(`no ${kind} paper`);
          continue;
        }
        const [had] = await ctx.db
          .select({ itemId: councilPapers.itemId })
          .from(councilPapers)
          .where(and(eq(councilPapers.councilId, c.id), eq(councilPapers.kind, kind)));
        if (had && had.itemId === item.itemId && ctx.args.force !== true) {
          ctx.count("unchanged");
          continue;
        }
        let pence = 0;
        try {
          const papers = await readPapers(ctx, c.id, item.documents);
          const text = listing(papers, kind === "risks" ? () => true : (p) => MONEY_PAGE.test(p));
          if (text.length < 500) {
            problems.push(`${c.id} ${kind}: no readable text in "${item.title.slice(0, 60)}"`);
            continue;
          }
          const ask =
            kind === "risks"
              ? `These are ${c.nameEn}'s papers for "${item.title}" (${item.committee}, ${item.date}). List every risk on the council's corporate or strategic risk register.`
              : kind === "budget"
                ? `These are ${c.nameEn}'s papers for "${item.title}" (${item.committee}, ${item.date}), the report that set its budget. Give the headline figures asked for.`
                : `These are ${c.nameEn}'s papers for "${item.title}" (${item.committee}, ${item.date}), on how its revenue budget is going this year. Give the figures asked for.`;
          const reply = await client.messages
            .stream({
              model: MODEL,
              max_tokens: 16000,
              system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
              messages: [{ role: "user", content: `${ask}\n\n${text}` }],
              output_config: { format: { type: "json_schema", schema: kind === "risks" ? RISK_SCHEMA : moneySchema(kind) } },
            })
            .finalMessage();
          pence = costPence(MODEL, reply.usage);
          const block = reply.content.find((b) => b.type === "text");
          const raw = JSON.parse(block && block.type === "text" ? block.text : "{}");
          let content: RisksContent | MoneyContent;
          if (kind === "risks") {
            const parsed = RiskOut.safeParse(raw);
            if (!parsed.success) throw new Error("reply didn't match the schema");
            content = checkRisks(ctx, papers, parsed.data);
            if (!(content as RisksContent).risks.length) {
              problems.push(`${c.id} risks: no risk passed the checks`);
              continue;
            }
            ctx.count("risks", (content as RisksContent).risks.length);
          } else {
            const parsed = MoneyOut.safeParse(raw);
            if (!parsed.success) throw new Error("reply didn't match the schema");
            content = checkMoney(ctx, kind, papers, parsed.data);
            if (!(content as MoneyContent).facts.length) {
              problems.push(`${c.id} ${kind}: no figure passed the checks`);
              continue;
            }
            ctx.count("figures", (content as MoneyContent).facts.length);
          }
          const row = { meetingId: item.meetingId, itemId: item.itemId, date: item.date, committee: item.committee, title: item.title, documents: item.documents, content, model: MODEL, costPence: pence, createdAt: new Date() };
          await ctx.db
            .insert(councilPapers)
            .values({ councilId: c.id, kind, ...row })
            .onConflictDoUpdate({ target: [councilPapers.councilId, councilPapers.kind], set: row });
          ctx.count(`written ${kind}`);
          ctx.touched.add("councils");
        } catch (err) {
          const msg = (err as Error).message;
          problems.push(`${c.id} ${kind}: ${msg.slice(0, 160)}`);
          if (/credit balance/i.test(msg)) break;
        } finally {
          budget -= pence;
          ctx.count("pence", Math.round(pence));
        }
      }
    }
    if (problems.length) throw new PartialFailure(problems.join("; "));
  },
};
