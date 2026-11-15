/**
 * Plain-language summaries of every council meeting whose minutes are
 * published, in English and Welsh, and the declarations of interest made at
 * them. Meetings of the full Council, Cabinet, scrutiny and planning
 * committees also get a preview before the minutes are out, from the reports
 * on the agenda: what is proposed and why, never what was decided.
 *
 * Councils publish no transcript, so a summary says what was decided and why,
 * drawn only from the meeting's minutes and agenda reports. A decision is
 * stated only when the minute records it. Every item cites the documents it
 * rests on; citations to anything outside the meeting are removed. Written
 * once minutes are out, once per meeting and prompt version, and again only
 * if the minutes or reports change. Spending stops at the month's cap
 * (summaryBudgetPence: SUMMARY_MONTHLY_BUDGET_GBP plus any one-off addition
 * agreed for that month), counted from a ledger of every call's cost in
 * pipeline_state ("summaries:spend:<month>"), failed calls included.
 *
 * Adapted from OpenSenedd's pipeline/jobs/summaries.ts.
 *
 *   pnpm pipeline summaries [--council cardiff] [--limit 30] [--minutes 200] [--meeting 12345] [--retry-failed]
 *   pnpm pipeline summaries --dry-run   # counts the meetings without a summary and the room left; spends nothing
 *
 * --meeting writes that one meeting's summary again even when it has one
 * (add --council to skip the other councils' queries).
 *
 * Until RECENT_ONLY lapses, a run summarises only meetings from its last
 * days and previews of upcoming ones; older meetings wait, and the run logs
 * how many. --repair and --meeting aren't limited.
 *
 * When the grounding check removes an overview's opening sentence, the rest
 * can start mid-thought ("It granted…"): a plain opening naming the body and
 * month takes its place, in both languages (withStandAloneOpening).
 *
 * A meeting whose reply was cut off or didn't match the schema isn't tried
 * again until its papers or the prompt change (pipeline_state
 * "summaries:failed:<council>"), so the same failure doesn't cost money on
 * every run, a repair included. --retry-failed, or --meeting for one
 * meeting, tries anyway.
 *
 * Repairing summaries whose English and Welsh don't match (for example,
 * English sentences removed by an older grounding check):
 *
 *   pnpm pipeline summaries --repair --dry-run   # counts them and estimates the cost; spends nothing
 *   pnpm pipeline summaries --repair [--council cardiff] [--limit 30]
 *
 * A repair rewrites those meetings' summaries with the API, so it costs money
 * and stays inside the month's cap like any other run. The dry run also says
 * how much is left under the cap.
 */
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { declarations, summaries } from "../../src/db/schema";
import { AI_MODEL_FAST, cachedSystem, costPence } from "../../src/lib/ai/config";
import { splitSentences, summaryMismatches, type MeetingSummaryContent } from "../../src/lib/summary";
import { formatDate } from "../../src/i18n/format";
import { welshCommitteeName } from "../../src/lib/committees";
import { recordCouncilsFor } from "../lib/councils";
import { PartialFailure, type Job, type JobContext } from "../lib/job";
import { isSpendLimit, notifyOwner, OUT_OF_CREDIT, SPEND_LIMIT } from "../lib/notify";
import { nameKeys } from "../lib/text";
import { argNumber, sha1 } from "../lib/util";
import { isDeclarationsItem } from "../sources/moderngov";
import { groundedPair, prepareSource, withStandAloneOpening } from "../lib/grounding";
import { rightWayRound } from "../lib/language";
import { fixWelsh } from "../lib/welsh-fixes";

export const SUMMARY_PROMPT_VERSION = "council-1";
/** The fast model by default: about a penny a meeting, so every meeting can have one. */
const MODEL = process.env.SUMMARY_MODEL || AI_MODEL_FAST;
/** The summaries' monthly cap in pounds: SUMMARY_MONTHLY_BUDGET_GBP, or £60 (agreed for OpenCouncils, 13 November 2026). */
const MONTHLY_BUDGET_GBP = Number(process.env.SUMMARY_MONTHLY_BUDGET_GBP || 60);
/**
 * One-off additions to the summaries' cap, by month, each agreed with Owen.
 * None now: on 12 November 2026 Owen set the summaries' cap at £30 a month to
 * bring running costs down, which ended November's £40 launch addition
 * (agreed on 8 November 2026).
 */
export const SUMMARY_BUDGET_EXTRA_GBP: Readonly<Record<string, number>> = {};

/**
 * Until a date, a run summarises only meetings from its last days, and
 * previews of upcoming ones; older meetings wait. Agreed with Owen on
 * 8 November 2026 (19:29): until 1 December 2026, the last 120 days, long
 * enough for a quarterly committee's minutes, which often come at its next
 * meeting. From 1 December the full catch-up resumes.
 */
export const RECENT_ONLY: Readonly<{ days: number; until: string }> | null = { days: 120, until: "2026-12-01" };

/** The recent-only window on a day ("2026-11-09"), or null once it has lapsed. */
export function recentWindow(today: string, setting = RECENT_ONLY): Readonly<{ days: number; until: string }> | null {
  return setting && today < setting.until ? setting : null;
}

/** The summaries' cap for a month ("2026-11"), in pence. */
export function summaryBudgetPence(month: string): number {
  return (MONTHLY_BUDGET_GBP + (SUMMARY_BUDGET_EXTRA_GBP[month] ?? 0)) * 100;
}

/**
 * Pence the summaries spent in a month before the spending ledger existed.
 * November 2026, up to 18:35 UTC on 8 November: about £44.70, from every
 * pipeline run's log.
 * - Written summaries: £32.01 by the runs' own totals, and about £1.65 for two
 *   runs that stopped before printing theirs (7 November's daily run, judged
 *   from the summaries' recorded costs either side of it, and a cancelled
 *   repair run).
 * - 545 calls cut off or not matching the schema: their recorded cost where a
 *   run recorded it (1.9p on average), and 2p each where it didn't: £10.87.
 * - Up to 8 calls broken off part way, at 2p each.
 * Later months start at nothing.
 */
export const SPENT_BEFORE_LEDGER_PENCE: Readonly<Record<string, number>> = {};

/** pipeline_state key for a month's spending ledger: every call's cost, written or failed. */
const spendKey = (month: string) => `summaries:spend:${month}`;

/**
 * At most eight calls can be under way when a run checks the cap (two runs
 * side by side, four calls each), and none costs more than about 2.5p at the
 * input and reply limits. A run stops this far short, so spending stays inside the cap.
 */
const RESERVE_PENCE = 24;

/**
 * Pence left under a month's cap. Spending is the ledger plus what came
 * before it, or what the summaries now held record, if that is more: the
 * ledger counts every call, including failed ones and the cost of summaries
 * a rewrite replaced, which the summaries table can't. Less a reserve for
 * calls already under way.
 */
export function roomLeftPence(cap: number, ledger: number, before: number, held: number, reserve = RESERVE_PENCE): number {
  return cap - Math.max(ledger + before, held) - reserve;
}
const MAX_DOC_CHARS = 14_000;
/** Summaries written at once. */
const PARALLEL = 4;
const MAX_MEETING_CHARS = 380_000;

/** pipeline_state key for one council's failed attempts: meeting ID to the input hash it failed on. */
const failedKey = (councilId: string) => `summaries:failed:${councilId}`;

/**
 * Whether a meeting's last attempt failed (the reply was cut off or didn't
 * match the schema) on exactly this input: the same papers and the same
 * prompt. Trying again would fail the same way and cost the same again, so
 * the job waits until the papers change.
 */
export function failedBefore(failed: Record<string, string>, meetingId: number, inputHash: string): boolean {
  return failed[String(meetingId)] === inputHash;
}

/** Whether a run skips a meeting that failed before on the same papers: every run does, a repair included, unless it asks for that meeting (--meeting) or for retries (--retry-failed). */
export function skipFailed(
  failed: Record<string, string>,
  meetingId: number,
  inputHash: string,
  run: { only?: number; retryFailed: boolean },
): boolean {
  return !run.only && !run.retryFailed && failedBefore(failed, meetingId, inputHash);
}

/**
 * The meetings that get summaries, in a query over meetings m joined to
 * committees c: minuted meetings (the main committees' back to 2022, other
 * committees' for a year), and previews of the main meetings from their
 * reports until the minutes arrive.
 */
const SUMMARISED = sql`m.cancelled = false
  and (
    -- Minuted meetings of any committee.
    ((m.minutes_published or m.decisions_published)
      -- Older meetings of other committees aren't worth the cost; the main ones go back to 2022.
      and (c.kind in ('council', 'cabinet', 'scrutiny', 'planning') or m.date > current_date - 365)
      and exists (select 1 from agenda_items a where a.council_id = m.council_id and a.meeting_id = m.id and a.minutes is not null))
    -- Previews of the main meetings, from their reports, until the minutes arrive.
    or (c.kind in ('council', 'cabinet', 'scrutiny', 'planning')
      and m.date between current_date - 60 and current_date + 30
      and exists (select 1 from documents d where d.council_id = m.council_id and d.meeting_id = m.id and d.text is not null))
  )`;

/**
 * The plain first sentence an overview gets when the check removes its own:
 * "The Planning Committee met in October 2026." and "Cyfarfu'r Pwyllgor
 * Cynllunio ym mis Hydref 2026." Only the year is a figure, and the
 * committee's name is in the papers' header, so the sentence passes the
 * check if it is run again.
 */
export function openingFor(committeeEn: string, committeeCy: string | null, date: string): { en: string; cy: string } {
  const en = committeeEn.trim().replace(/^the\s+/i, "");
  // The council's Welsh name, or the standard one for a committee every council has ("Council" is "Cyngor llawn").
  const cy = (committeeCy?.trim() || welshCommitteeName(committeeEn) || committeeEn.trim()).replace(/^(y|yr|the)\s+/i, "");
  return {
    en: `The ${en} met in ${formatDate("en", date, "month")}.`,
    cy: `Cyfarfu'r ${cy} ym mis ${formatDate("cy", date, "month")}.`,
  };
}

/**
 * English openings that plainly lean on a sentence before them: "It also…",
 * "They then…", "It granted…", "The other two…", "However, …". Kept narrow so
 * an overview that could stand on its own is never touched: impersonal uses
 * such as "It was agreed…" or "It seemed…" don't count, nor does "Its…".
 */
const MID_THOUGHT = [
  /^(It|They)\s+(also|then|too|further|again|additionally|subsequently)\b/,
  /^(It|They)\s+(?!(?:seemed|appeared|emerged|followed|remained|transpired|needed)\b)[a-z]+ed\b/,
  /^The others?\b/,
  /^(Also|However|Then|Furthermore|Additionally|In addition|Meanwhile),\s/,
];

/**
 * A Welsh plain opening written with the committee's English name before
 * openingFor looked up the standard Welsh one ("Cyfarfu'r Council ym mis Medi
 * 2026."), with the Welsh name put in. Anything else is left as it is.
 */
export function withWelshOpeningName(cy: string, committeeEn: string, opening: { cy: string }): string {
  const wrong = `Cyfarfu'r ${committeeEn.trim().replace(/^(y|yr|the)\s+/i, "")} ym mis `;
  const at = opening.cy.indexOf(" ym mis ");
  const right = at === -1 ? "" : opening.cy.slice(0, at + " ym mis ".length);
  if (!right || right === wrong || !cy.startsWith(wrong)) return cy;
  return right + cy.slice(wrong.length);
}

/** Whether an English overview's first sentence plainly depends on one before it. */
export function startsMidThought(en: string): boolean {
  const first = splitSentences(en)[0]?.trim() ?? "";
  return MID_THOUGHT.some((re) => re.test(first));
}

/**
 * Mends a stored overview that starts mid-thought, written before the job
 * replaced removed openings (withStandAloneOpening). The English decides:
 * when it plainly starts mid-thought, both languages get the plain opening.
 * Where the Welsh kept a first sentence the English lost (it has one sentence
 * more), that sentence goes, so the two stay in step. Applied twice, it
 * changes nothing the second time.
 */
export function withOpeningIfMidThought(
  o: { en: string; cy: string },
  opening: { en: string; cy: string },
): { en: string; cy: string; added: boolean } {
  if (!startsMidThought(o.en)) return { ...o, added: false };
  const e = splitSentences(o.en);
  const c = splitSentences(o.cy);
  const cy = c.length === e.length + 1 ? c.slice(1) : c;
  return { en: [opening.en, ...e].join(" "), cy: cy.length ? [opening.cy, ...cy].join(" ") : o.cy, added: true };
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overview_en", "overview_cy", "items", "declarations"],
  properties: {
    overview_en: {
      type: "string",
      description: "Two or three sentences in English: what the meeting dealt with and the main decisions.",
    },
    overview_cy: { type: "string", description: "The same overview in natural Welsh." },
    items: {
      type: "array",
      description:
        "The substantive agenda items, in order. Leave out procedural items: apologies, declarations of interest, approving the previous minutes, public questions with no decision, exclusion of the public.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["item", "headline_en", "headline_cy", "decided_en", "decided_cy", "proposed_en", "proposed_cy", "why_en", "why_cy", "sources"],
        properties: {
          item: { type: "integer", description: "The item number N from 'Item N:' in the input." },
          headline_en: { type: "string", description: "A plain title for the item in English, under 12 words." },
          headline_cy: { type: "string", description: "The same title in natural Welsh." },
          decided_en: {
            type: "string",
            description:
              "What the meeting decided, in plain English, taken only from the minute. Empty string if the minute records no decision.",
          },
          decided_cy: { type: "string", description: "The same in natural Welsh. Empty if decided_en is empty." },
          proposed_en: {
            type: "string",
            description:
              "What the item's report recommends the meeting decide, attributed (\"The report recommends…\"), in one or two plain sentences. Empty if there is no report or recommendation.",
          },
          proposed_cy: { type: "string", description: "The same in natural Welsh. Empty if proposed_en is empty." },
          why_en: {
            type: "string",
            description:
              "Why: the reasons, background and effects given in the minute or the reports, in one to three plain sentences. Name who said what when the minute does.",
          },
          why_cy: { type: "string", description: "The same in natural Welsh." },
          sources: {
            type: "array",
            items: { type: "integer" },
            description: "The [d…] numbers of the documents this item rests on. Empty if it rests on the minute alone.",
          },
        },
      },
    },
    declarations: {
      type: "array",
      description:
        "Every declaration of interest recorded in the minutes. Empty if the minutes record none or say there were none.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "item", "kind", "nature_en", "nature_cy"],
        properties: {
          name: { type: "string", description: "The councillor's name exactly as the minute gives it, without 'Councillor'." },
          item: {
            type: "integer",
            description: "The item number N the interest relates to, from 'Item N:' in the input. 0 if the minute doesn't say or it matches no item.",
          },
          kind: { type: "string", enum: ["personal", "prejudicial", "personal-and-prejudicial", "other"] },
          nature_en: { type: "string", description: "The interest, in plain English, as the minute describes it." },
          nature_cy: { type: "string", description: "The same in natural Welsh." },
        },
      },
    },
  },
} as const;

const Output = z.object({
  overview_en: z.string(),
  overview_cy: z.string(),
  items: z.array(
    z.object({
      item: z.number().int(),
      headline_en: z.string(),
      headline_cy: z.string(),
      decided_en: z.string(),
      decided_cy: z.string(),
      proposed_en: z.string(),
      proposed_cy: z.string(),
      why_en: z.string(),
      why_cy: z.string(),
      sources: z.array(z.number().int()),
    }),
  ),
  declarations: z.array(
    z.object({
      name: z.string(),
      item: z.number().int(),
      kind: z.enum(["personal", "prejudicial", "personal-and-prejudicial", "other"]),
      nature_en: z.string(),
      nature_cy: z.string(),
    }),
  ),
});

const SYSTEM = `You summarise UK local council meetings for an independent, non-partisan public record. Readers are residents, journalists and community groups who may know nothing about how councils work.

Councils publish no transcript. You have the meeting's minutes, when they have been published, and the reports on its agenda. When an item says "Minute: none published", the meeting hasn't been minuted yet: say what is proposed, never what was decided, and leave decided_en empty. In the overview, say what the meeting will consider or considered, not what it decided, unless a minute records it.

Rules:
- Use only the minutes and documents provided. Add nothing from your own knowledge.
- State a decision only when the minute records it. Never infer a decision from a report's recommendations: a report proposes, the minute records what was decided.
- Be neutral. Attribute arguments and claims to whoever made them, by name, as the minute does.
- Explain any council term where it appears (for example "call-in", "scrutiny", "Section 106", "delegated powers") in a few plain words.
- Plain British English: short sentences, active voice, no em dashes, no jargon, no words of praise or blame.
- Write the Welsh as natural Welsh for Welsh readers, using local government terms councils use (Cyngor llawn, Cabinet, craffu, cynllunio, cynghorydd).
- The English and Welsh of each field say the same things in the same order, sentence for sentence: the same number of sentences in each language. Begin with the substance (what was decided or proposed); don't open with when or where the meeting met.

Welsh grammar to get right:
- Numbers agree with the noun's gender and mutate it. "Cais" (application) is masculine: "dau gais", "tri chais", "pedwar cais", never "tair cais" or "dwy gais". Feminine nouns take "dwy", "tair", "pedair".
- "A" (and) becomes "ac" before a vowel: "ac estyniad", "ac adroddiad".
- Read each Welsh sentence again for repeated letters or syllables (write "sefyllfa", never "sefsefyllfa").`;

/** The schema without its Welsh fields, for councils outside Wales: nobody reads the Welsh there, so it isn't paid for. */
export function englishSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.filter((v) => !(typeof v === "string" && v.endsWith("_cy"))).map(englishSchema);
  if (!node || typeof node !== "object") return node;
  return Object.fromEntries(
    Object.entries(node as Record<string, unknown>)
      .filter(([k]) => !k.endsWith("_cy"))
      .map(([k, v]) => [k, englishSchema(v)]),
  );
}

/** Fills each Welsh field of an English-only reply with its English, so the stored summary keeps one shape. */
export function withEnglishAsWelsh(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withEnglishAsWelsh);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    out[k] = withEnglishAsWelsh(v);
    if (k.endsWith("_en")) out[k.slice(0, -3) + "_cy"] = v;
  }
  return out;
}

export const SYSTEM_EN = SYSTEM.split("\n")
  .filter((line) => !/Welsh|Cyngor llawn|"Cais"|"A" \(and\)|sefyllfa|English and Welsh/.test(line))
  .join("\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim()
  .concat("\n- Begin with the substance (what was decided or proposed); don't open with when or where the meeting met.");
export const SCHEMA_EN = englishSchema(SCHEMA) as typeof SCHEMA;

type ItemRow = { id: number; seq: number; number: string | null; title: string; minutes: string | null; agendaText: string | null };
type DocRow = { id: number; agendaItemId: number | null; title: string; text: string | null };

function meetingText(meta: { committee: string; council: string; date: string }, items: ItemRow[], docs: DocRow[]): string {
  const out = [`Meeting: ${meta.committee}, ${meta.council}, ${meta.date}`, ""];
  for (const it of items) {
    out.push("", `Item ${it.seq}: ${it.number ? `${it.number} ` : ""}${it.title}`);
    if (it.agendaText) out.push(`Agenda description: ${it.agendaText}`);
    out.push(it.minutes ? `Minute:\n${it.minutes}` : "Minute: none published");
    for (const d of docs.filter((d) => d.agendaItemId === it.id && d.text)) {
      const text = d.text!.length > MAX_DOC_CHARS ? `${d.text!.slice(0, MAX_DOC_CHARS)}\n[…]` : d.text!;
      out.push(`[d${d.id}] Document "${d.title}":\n${text}`);
    }
  }
  let text = out.join("\n");
  if (text.length > MAX_MEETING_CHARS) text = `${text.slice(0, MAX_MEETING_CHARS)}\n[The rest is left out for length.]`;
  return text;
}

type Parsed = z.infer<typeof Output>;

/**
 * The stored summary from the model's reply: each English and Welsh pair put
 * the right way round, checked against the papers together (a sentence that
 * fails in either language goes from both), and known Welsh slips corrected.
 */
export function buildContent(
  data: Parsed,
  sourceText: string,
  itemBySeq: Map<number, Pick<ItemRow, "id" | "minutes">>,
  docIds: Set<number>,
  minuted: boolean,
  count: (key: string, by: number) => void = () => {},
  onDropped: () => void = () => {},
  /** A plain first sentence for the overview, used when the check removes its own (see withStandAloneOpening). */
  opening?: { en: string; cy: string },
): MeetingSummaryContent {
  const src = prepareSource(sourceText);
  const pair = (en: string, cy: string, standAlone = false) => {
    const turned = rightWayRound(en.trim(), cy.trim());
    const checked = groundedPair(turned.en, turned.cy, src);
    count("sentencesRemoved", checked.removed);
    if (!checked.paired) count("fieldsUnpaired", 1);
    let g = { en: checked.en, cy: checked.cy };
    if (standAlone && opening) {
      const s = withStandAloneOpening(turned, checked, opening);
      if (s.replaced) count("openingsReplaced", 1);
      g = { en: s.en, cy: s.cy };
    }
    const w = fixWelsh(g.cy);
    count("welshFixed", w.fixed);
    return { en: g.en, cy: w.text };
  };
  const o = pair(data.overview_en, data.overview_cy, true);
  return {
    mode: minuted ? "minutes" : "preview",
    overviewEn: o.en,
    overviewCy: o.cy,
    items: data.items.flatMap((it) => {
      const item = itemBySeq.get(it.item);
      if (!item) {
        onDropped();
        return [];
      }
      const h = pair(it.headline_en, it.headline_cy);
      // A decision can only be reported for an item whose minute exists.
      const d = item.minutes ? pair(it.decided_en, it.decided_cy) : { en: "", cy: "" };
      const w = pair(it.why_en, it.why_cy);
      const p = pair(it.proposed_en, it.proposed_cy);
      return [
        {
          agendaItemId: Number(item.id),
          headlineEn: h.en,
          headlineCy: h.cy,
          decidedEn: d.en,
          decidedCy: d.en ? d.cy : "",
          whyEn: w.en,
          whyCy: w.cy,
          proposedEn: p.en,
          proposedCy: p.en ? p.cy : "",
          sources: it.sources.filter((x) => docIds.has(x)),
        },
      ];
    }),
  };
}

/** Pence on a month's ledger. */
async function ledgerPence(ctx: JobContext, month: string): Promise<number> {
  const r = await ctx.db.execute<{ pence: number }>(
    sql`select coalesce((value->>'pence')::float8, 0) as pence from pipeline_state where key = ${spendKey(month)}`,
  );
  return Number(r[0]?.pence ?? 0);
}

/** Pence recorded on the summaries now held that were written this month. */
async function heldPence(ctx: JobContext): Promise<number> {
  const r = await ctx.db.execute<{ pence: number }>(
    sql`select coalesce(sum(cost_pence), 0)::float8 as pence from summaries where created_at >= date_trunc('month', now())`,
  );
  return Number(r[0]?.pence ?? 0);
}

interface Spending {
  ledger: number;
  before: number;
  held: number;
}

/** A month's spending so far: the ledger, what came before it, and what the summaries held record. */
async function spending(ctx: JobContext, month: string): Promise<Spending> {
  return { ledger: await ledgerPence(ctx, month), before: SPENT_BEFORE_LEDGER_PENCE[month] ?? 0, held: await heldPence(ctx) };
}

/** A council's meetings that get summaries and have none yet: from the window's days, and older (none older without a window). */
async function withoutSummary(ctx: JobContext, councilId: string, days: number | null): Promise<{ recent: number; older: number }> {
  const cutoff = days === null ? sql`'-infinity'::date` : sql`current_date - ${days}::int`;
  const r = await ctx.db.execute<{ recent: number; older: number }>(sql`
    select count(*) filter (where m.date >= ${cutoff})::int as recent, count(*) filter (where m.date < ${cutoff})::int as older
    from meetings m
    join committees c on c.council_id = m.council_id and c.id = m.committee_id
    left join summaries s on s.council_id = m.council_id and s.meeting_id = m.id and s.prompt_version = ${SUMMARY_PROMPT_VERSION}
    where m.council_id = ${councilId} and ${SUMMARISED} and s.id is null`);
  return { recent: Number(r[0]?.recent ?? 0), older: Number(r[0]?.older ?? 0) };
}

/** One line for the run's log on how a month's spending stands against its cap. */
export function spendingNote(month: string, s: Spending): string {
  const gbp = (p: number) => `£${(p / 100).toFixed(2)}`;
  const cap = summaryBudgetPence(month);
  const left = Math.max(roomLeftPence(cap, s.ledger, s.before, s.held, 0), 0);
  return `${month}: cap ${gbp(cap)}, about ${gbp(left)} left (${gbp(s.before)} spent before the ledger, ${gbp(s.ledger)} on it; the summaries held record ${gbp(s.held)})`;
}

/** Adds a call's cost to the month's ledger in one statement, so calls side by side never lose an update. */
async function recordSpend(ctx: JobContext, month: string, pence: number): Promise<void> {
  await ctx.db.execute(sql`
    insert into pipeline_state (key, value, updated_at)
    values (${spendKey(month)}, jsonb_build_object('pence', ${pence}::float8), now())
    on conflict (key) do update
      set value = jsonb_build_object('pence', coalesce((pipeline_state.value->>'pence')::float8, 0) + ${pence}::float8),
          updated_at = now()`);
}

export const summariesJob: Job = {
  name: "summaries",
  description: "Plain-language summaries of every minuted meeting, and previews of the main ones, in English and Welsh",
  async run(ctx) {
    const repair = ctx.args.repair === true;
    // Meetings whose stored summary has English and Welsh out of step, by council.
    const toRepair = new Map<string, number[]>();
    if (repair) {
      let n = 0;
      let pence = 0;
      for (const council of recordCouncilsFor(ctx)) {
        const held = await ctx.db.execute<{ meetingId: number; content: MeetingSummaryContent; pence: number }>(sql`
          select meeting_id as "meetingId", content, coalesce(cost_pence, 0)::float8 as pence
          from summaries where council_id = ${council.id} and prompt_version = ${SUMMARY_PROMPT_VERSION}
        `);
        const ids = held.filter((r) => summaryMismatches(r.content).length > 0);
        if (ids.length) toRepair.set(council.id, ids.map((r) => Number(r.meetingId)));
        n += ids.length;
        pence += ids.reduce((t, r) => t + Number(r.pence), 0);
        if (ids.length) ctx.count(`toRepair:${council.id}`, ids.length);
      }
      ctx.count("toRepair", n);
      ctx.stats.estimatedPence = Math.round(pence);
      ctx.log(`${n} summaries have English and Welsh out of step; rewriting them would cost about £${(pence / 100).toFixed(2)}, judging by what they cost to write`);
      if (ctx.args["dry-run"] === true) {
        const month = new Date().toISOString().slice(0, 7);
        const s = await spending(ctx, month);
        ctx.stats.roomLeftPence = Math.round(roomLeftPence(summaryBudgetPence(month), s.ledger, s.before, s.held));
        ctx.log(spendingNote(month, s));
        return;
      }
    }
    const only = argNumber(ctx.args, "meeting");
    // Until RECENT_ONLY lapses, older meetings wait; a repair and --meeting aren't limited.
    const recent = repair || only ? null : recentWindow(new Date().toISOString().slice(0, 10));
    if (recent || ctx.args["dry-run"] === true) {
      let recentNone = 0;
      let olderNone = 0;
      for (const council of recordCouncilsFor(ctx)) {
        const n = await withoutSummary(ctx, council.id, recent?.days ?? null);
        recentNone += n.recent;
        olderNone += n.older;
      }
      if (recent) {
        ctx.count("olderWaiting", olderNone);
        ctx.log(`Until ${recent.until}, only meetings from the last ${recent.days} days are summarised: ${olderNone} older meetings without a summary wait`);
      }
      if (ctx.args["dry-run"] === true) {
        // Counts what a run would summarise and the room left; spends nothing.
        ctx.count("withoutSummary", recentNone);
        ctx.log(`${recentNone} meetings${recent ? ` from the last ${recent.days} days` : ""} have no summary yet`);
        const month = new Date().toISOString().slice(0, 7);
        const s = await spending(ctx, month);
        ctx.stats.roomLeftPence = Math.round(roomLeftPence(summaryBudgetPence(month), s.ledger, s.before, s.held));
        ctx.log(spendingNote(month, s));
        return;
      }
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      ctx.log("ANTHROPIC_API_KEY is not set; skipping");
      ctx.stats.skipped = "no API key";
      return;
    }
    const client = new Anthropic();
    const limit = argNumber(ctx.args, "limit") ?? 30;
    // Stop starting new summaries in time for the run to finish well inside the workflow's limit.
    const deadline = Date.now() + (argNumber(ctx.args, "minutes") ?? 200) * 60_000;
    const retryFailed = ctx.args["retry-failed"] === true;

    // The cap counts real spending, from the ledger, checked before every call so runs side by side can't pass it.
    const month = new Date().toISOString().slice(0, 7);
    const cap = summaryBudgetPence(month);
    const room = async () => {
      const s = await spending(ctx, month);
      return roomLeftPence(cap, s.ledger, s.before, s.held);
    };
    let budgetReached = false;
    const stopForBudget = () => {
      if (!budgetReached) ctx.warn(`The summaries' cap for ${month} (£${(cap / 100).toFixed(2)}) is reached; the rest wait for next month`);
      budgetReached = true;
      ctx.count("waitingForBudget");
    };
    const atStart = await spending(ctx, month);
    ctx.stats.roomLeftPence = Math.round(roomLeftPence(cap, atStart.ledger, atStart.before, atStart.held));
    ctx.log(spendingNote(month, atStart));
    let outOfCredit = false;

    // Councils with the fewest summaries go first, so every council gets its turn.
    const held = await ctx.db.execute<{ c: string; n: number }>(sql`select council_id as c, count(*)::int as n from summaries group by 1`);
    const heldBy = new Map(held.map((r) => [r.c, Number(r.n)]));
    const councils = [...recordCouncilsFor(ctx)].sort((a, b) => (heldBy.get(a.id) ?? 0) - (heldBy.get(b.id) ?? 0));
    for (const council of councils) {
      if (outOfCredit || budgetReached) break;
      const welsh = council.nation === "Wales";
      const repairIds = toRepair.get(council.id) ?? [];
      if (repair && !repairIds.length) continue;
      const failed = (await ctx.getState<Record<string, string>>(failedKey(council.id))) ?? {};
      let failedChanged = false;
      const rememberFailure = (meetingId: number, inputHash: string, pence: number) => {
        failed[String(meetingId)] = inputHash;
        failedChanged = true;
        ctx.count("failedPence", Math.round(pence));
      };
      // Meetings of summarised committees with minutes, without a summary for this prompt version, newest first.
      const todo = await ctx.db.execute<{ id: number; date: string; committee: string; committeeCy: string | null; hash: string | null }>(sql`
        select m.id, m.date::text as date, c.name_en as committee, c.name_cy as "committeeCy", s.input_hash as hash
        from meetings m
        join committees c on c.council_id = m.council_id and c.id = m.committee_id
        left join summaries s on s.council_id = m.council_id and s.meeting_id = m.id and s.prompt_version = ${SUMMARY_PROMPT_VERSION}
        where m.council_id = ${council.id} and ${SUMMARISED}
          ${repair
            ? sql`-- Repair: only the summaries whose English and Welsh are out of step.
                and m.id in (${sql.join(repairIds.map((id) => sql`${id}`), sql`, `)})`
            : only
              ? sql`-- One meeting asked for by --meeting: written again even if it has a summary.`
              : sql`-- No summary yet, or the meeting's record has changed since it was written.
                and (s.id is null or m.detail_fetched_at > s.created_at)
                ${recent ? sql`-- Recent meetings only, until RECENT_ONLY lapses.
                  and m.date >= current_date - ${recent.days}::int` : sql``}`}
          ${only ? sql`and m.id = ${only}` : sql``}
        order by (c.kind in ('council', 'cabinet', 'scrutiny', 'planning')) desc, m.date desc, m.id desc
        limit ${limit * 3 + Object.keys(failed).length}
      `);

      const people = await ctx.db.execute<{ id: number; name: string }>(
        sql`select id, name from councillors where council_id = ${council.id}`,
      );
      const byKey = new Map<string, Set<number>>();
      for (const p of people)
        for (const k of nameKeys(p.name)) byKey.set(k, (byKey.get(k) ?? new Set()).add(Number(p.id)));
      /** A councillor ID only when the recorded name points to exactly one councillor. */
      const matchName = (name: string): number | null => {
        for (const k of nameKeys(name)) {
          const ids = byKey.get(k);
          if (ids?.size === 1) return [...ids][0];
          if (ids && ids.size > 1) return null;
        }
        return null;
      };

      let written = 0;
      let running = 0;
      const one = async (m: (typeof todo)[number]): Promise<void> => {
        if (written + running >= limit || outOfCredit || budgetReached || Date.now() > deadline) return;
        running++;
        try {
        if ((await room()) <= 0) {
          stopForBudget();
          return;
        }
        const items = await ctx.db.execute<ItemRow>(sql`
          select id, seq, number, title, minutes, agenda_text as "agendaText"
          from agenda_items where council_id = ${council.id} and meeting_id = ${m.id} order by seq
        `);
        const docs = await ctx.db.execute<DocRow>(sql`
          select id, agenda_item_id as "agendaItemId", title, text
          from documents where council_id = ${council.id} and meeting_id = ${m.id} order by id
        `);
        const text = meetingText({ committee: m.committee, council: council.nameEn, date: m.date }, [...items], [...docs]);
        const inputHash = sha1(`${SUMMARY_PROMPT_VERSION}\n${text}`);
        if (m.hash === inputHash && !repair && !only) return;
        if (skipFailed(failed, m.id, inputHash, { only, retryFailed })) {
          ctx.count("skippedFailedBefore");
          return;
        }

        let reply;
        try {
          reply = await client.messages
            .stream({
              model: MODEL,
              max_tokens: 32000,
              system: cachedSystem(welsh ? SYSTEM : SYSTEM_EN),
              messages: [{ role: "user", content: text }],
              output_config: { format: { type: "json_schema", schema: welsh ? SCHEMA : SCHEMA_EN } },
            })
            .finalMessage();
        } catch (err) {
          ctx.warn(`${council.id}: summary failed for meeting ${m.id}: ${(err as Error).message}`);
          ctx.count("failures");
          if (/credit balance/i.test((err as Error).message)) {
            await notifyOwner(ctx, OUT_OF_CREDIT.key, OUT_OF_CREDIT.subject, OUT_OF_CREDIT.body);
            outOfCredit = true;
            return;
          }
          if (isSpendLimit((err as Error).message)) {
            await notifyOwner(ctx, SPEND_LIMIT.key, SPEND_LIMIT.subject, SPEND_LIMIT.body);
            outOfCredit = true;
            return;
          }
          return;
        }
        const pence = costPence(MODEL, reply.usage);
        // Every call goes on the ledger, written or not; if it can't be recorded, stop spending.
        try {
          await recordSpend(ctx, month, pence);
        } catch (err) {
          ctx.warn(`couldn't record the cost of a summary, so no more will be written in this run: ${(err as Error).message}`);
          budgetReached = true;
        }
        ctx.count("spentPence", Math.round(pence * 100) / 100);
        const block = reply.content.find((b) => b.type === "text");
        let json: unknown = null;
        try {
          json = JSON.parse(block && block.type === "text" ? block.text : "{}");
        } catch {
          ctx.warn(`${council.id}: summary for meeting ${m.id} was cut off (${reply.stop_reason})`);
          ctx.count("failures");
          rememberFailure(m.id, inputHash, pence);
          return;
        }
        const parsed = Output.safeParse(welsh ? json : withEnglishAsWelsh(json));
        if (!parsed.success) {
          ctx.warn(`${council.id}: summary for meeting ${m.id} didn't match the schema`);
          ctx.count("failures");
          rememberFailure(m.id, inputHash, pence);
          return;
        }

        const itemBySeq = new Map(items.map((i) => [Number(i.seq), i]));
        const docIds = new Set(docs.map((d) => Number(d.id)));
        let dropped = 0;
        const minuted = items.some((i) => i.minutes);
        const content = buildContent(
          parsed.data,
          text,
          itemBySeq,
          docIds,
          minuted,
          (key, n) => ctx.count(key, n),
          () => dropped++,
          openingFor(m.committee, m.committeeCy, m.date),
        );
        ctx.count("itemsDropped", dropped);
        const mismatched = summaryMismatches(content).length;
        if (mismatched) ctx.count("summariesMismatched");

        // Declarations only from meetings whose declarations item has a minute.
        const declItem = items.find((i) => isDeclarationsItem(i.title) && i.minutes);
        const declRows = declItem
          ? parsed.data.declarations
              .filter((d) => d.name.trim())
              .map((d) => ({
                councilId: council.id,
                meetingId: m.id,
                councillorId: matchName(d.name),
                nameAsRecorded: d.name.trim(),
                agendaItemId: itemBySeq.get(d.item) ? Number(itemBySeq.get(d.item)!.id) : null,
                itemAsRecorded: itemBySeq.get(d.item)?.title ?? null,
                kind: d.kind,
                natureEn: d.nature_en || null,
                natureCy: d.nature_cy || null,
                source: "minutes-ai",
              }))
          : [];

        await ctx.db.transaction(async (tx) => {
          await tx
            .delete(summaries)
            .where(
              and(
                eq(summaries.councilId, council.id),
                eq(summaries.meetingId, m.id),
                eq(summaries.promptVersion, SUMMARY_PROMPT_VERSION),
              ),
            );
          await tx.insert(summaries).values({
            councilId: council.id,
            meetingId: m.id,
            promptVersion: SUMMARY_PROMPT_VERSION,
            inputHash,
            model: MODEL,
            content,
            costPence: pence,
          });
          await tx.delete(declarations).where(and(eq(declarations.councilId, council.id), eq(declarations.meetingId, m.id)));
          if (declRows.length) await tx.insert(declarations).values(declRows);
        });
        written++;
        ctx.count("written");
        if (failed[String(m.id)]) {
          delete failed[String(m.id)];
          failedChanged = true;
        }
        ctx.count("declarations", declRows.length);
        ctx.count("pence", Math.round(pence));
        ctx.touched.add(`meeting:${council.id}:${m.id}`);
        } finally {
          running--;
        }
      };
      // A few at a time: each reply takes a minute or so.
      let next = 0;
      await Promise.all(
        Array.from({ length: PARALLEL }, async () => {
          while (next < todo.length && written < limit && !outOfCredit && !budgetReached && Date.now() <= deadline) await one(todo[next++]);
        }),
      );
      if (failedChanged) await ctx.setState(failedKey(council.id), failed);
      if (Date.now() > deadline) {
        ctx.count("stoppedForTime");
        break;
      }
    }
    if (ctx.stats.written) {
      ctx.touched.add("meetings");
      ctx.touched.add("councillors");
    }
    if (Number(ctx.stats.failures ?? 0) > 0) throw new PartialFailure("Some summaries could not be written");
  },
};

/**
 * Applies the grounding check (pipeline/lib/grounding.ts) to summaries written
 * before it existed: rebuilds each meeting's source text from the database
 * and removes unsupported sentences. Changes nothing the papers support. An
 * overview that starts mid-thought ("It also…") gets the plain opening the
 * summaries job now writes (withOpeningIfMidThought). No API calls.
 *
 *   pnpm pipeline reground [--council cardiff]
 */
export const regroundJob: Job = {
  name: "reground",
  description: "Removes sentences from existing summaries that the meeting's papers don't support, and gives an overview that starts mid-thought a plain opening",
  async run(ctx) {
    for (const council of recordCouncilsFor(ctx)) {
      const list = await ctx.db.execute<{ id: number; meetingId: number; date: string; committee: string; committeeCy: string | null; content: MeetingSummaryContent }>(sql`
        select s.id, s.meeting_id as "meetingId", m.date::text as date, c.name_en as committee, c.name_cy as "committeeCy", s.content
        from summaries s
        join meetings m on m.council_id = s.council_id and m.id = s.meeting_id
        join committees c on c.council_id = m.council_id and c.id = m.committee_id
        where s.council_id = ${council.id}
      `);
      for (const row of list) {
        const items = await ctx.db.execute<ItemRow>(sql`
          select id, seq, number, title, minutes, agenda_text as "agendaText"
          from agenda_items where council_id = ${council.id} and meeting_id = ${row.meetingId} order by seq
        `);
        const docs = await ctx.db.execute<DocRow>(sql`
          select id, agenda_item_id as "agendaItemId", title, text
          from documents where council_id = ${council.id} and meeting_id = ${row.meetingId} order by id
        `);
        const src = prepareSource(meetingText({ committee: row.committee, council: council.nameEn, date: row.date }, [...items], [...docs]));
        let removed = 0;
        let swapped = 0;
        let fixed = 0;
        const pair = (a: string | undefined, b: string | undefined) => {
          const r = rightWayRound(a ?? "", b ?? "");
          if (r.swapped) swapped++;
          const g = groundedPair(r.en, r.cy, src);
          removed += g.removed;
          const w = fixWelsh(g.cy);
          fixed += w.fixed;
          return { en: g.en, cy: w.text };
        };
        const c = row.content;
        // The overview, as buildContent writes it: an opening the check removes, or one
        // already missing ("It also…"), gets the plain opening in both languages.
        const opening = openingFor(row.committee, row.committeeCy, row.date);
        const turned = rightWayRound(c.overviewEn ?? "", c.overviewCy ?? "");
        if (turned.swapped) swapped++;
        const checked = groundedPair(turned.en, turned.cy, src);
        removed += checked.removed;
        const standAlone = withStandAloneOpening(turned, checked, opening);
        const mended = withOpeningIfMidThought(standAlone, opening);
        const renamed = withWelshOpeningName(mended.cy, row.committee, opening);
        const opened = standAlone.replaced || mended.added || renamed !== mended.cy ? 1 : 0;
        const welsh = fixWelsh(renamed);
        fixed += welsh.fixed;
        const o = { en: mended.en, cy: welsh.text };
        const next: MeetingSummaryContent = {
          ...c,
          overviewEn: o.en,
          overviewCy: o.cy,
          items: c.items.map((it) => {
            const h = pair(it.headlineEn, it.headlineCy);
            const d = pair(it.decidedEn, it.decidedCy);
            const w = pair(it.whyEn, it.whyCy);
            const p = pair(it.proposedEn, it.proposedCy);
            return {
              ...it,
              headlineEn: h.en,
              headlineCy: h.cy,
              decidedEn: d.en,
              decidedCy: d.en ? d.cy : "",
              whyEn: w.en,
              whyCy: w.cy,
              proposedEn: p.en,
              proposedCy: p.en ? p.cy : "",
            };
          }),
        };
        if (!removed && !swapped && !fixed && !opened) continue;
        await ctx.db.update(summaries).set({ content: next }).where(eq(summaries.id, row.id));
        ctx.count("summariesChanged");
        ctx.count("openingsAdded", opened);
        ctx.count("sentencesRemoved", removed);
        ctx.count("fieldsSwapped", swapped);
        ctx.count("welshFixed", fixed);
        ctx.touched.add(`meeting:${council.id}:${row.meetingId}`);
      }
    }
    if (ctx.stats.summariesChanged) ctx.touched.add("meetings");
  },
};
