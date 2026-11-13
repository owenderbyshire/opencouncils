import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { IssueDef } from "@data/curated/compare-decisions";
import { taxFigures, rowState } from "@/lib/compare-decisions";
import { councilConfig } from "@/lib/councils";
import { meetingUrl } from "@/lib/official-urls";
import { SITE } from "@/lib/site";
import { getCouncilData } from "./council-data";
import { rows, sql } from "./db";

/** What OpenCouncil holds for one agenda item named in an issue table. */
export interface HeldItem {
  councilId: string;
  agendaItemId: number;
  meetingId: number;
  date: string;
  committeeKind: string;
  title: string;
  /** The recorded decision, word for word, from the minutes. */
  recorded: string | null;
  summaryEn: string | null;
  summaryCy: string | null;
  /** The council's own page for the meeting, where the pipeline stored one. */
  sourceUrl: string | null;
}

/**
 * The agenda items an issue table names (data/curated/compare-decisions.ts),
 * read from the search index so the plain sentence is the summary's own.
 */
export async function heldItems(issue: Pick<IssueDef, "slug" | "cells">): Promise<HeldItem[]> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("meetings");
  const keys = issue.cells.filter((c) => c.agendaItemId).map((c) => sql`(${c.council}, ${c.agendaItemId!})`);
  if (!keys.length) return [];
  return rows<HeldItem>(sql`
    select i.council_id as "councilId", i.agenda_item_id as "agendaItemId", i.meeting_id as "meetingId", i.date::text as date,
      i.committee_kind as "committeeKind", i.title, i.decision as recorded, nullif(i.decided_en, '') as "summaryEn", nullif(i.decided_cy, '') as "summaryCy",
      m.source_url as "sourceUrl"
    from search_items i
    join meetings m on m.council_id = i.council_id and m.id = i.meeting_id
    where (i.council_id, i.agenda_item_id) in (${sql.join(keys, sql`, `)})`);
}

/** One issue table as open data: every council's row, with its sources. */
export async function apiCompare(issue: IssueDef): Promise<Array<Record<string, string | number | null>>> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("meetings", "reference");
  const [held, money] = await Promise.all([heldItems(issue), issue.slug === "council-tax-2026-27" ? getCouncilData() : Promise.resolve(null)]);
  const tax = taxFigures(money, "2026-27");
  const byKey = new Map(held.map((h) => [`${h.councilId}:${h.agendaItemId}`, h]));
  return issue.cells.map((cell) => {
    const c = councilConfig(cell.council);
    const item = cell.agendaItemId ? (byKey.get(`${cell.council}:${cell.agendaItemId}`) ?? null) : null;
    const state = rowState(cell, item);
    const f = tax?.councils[cell.council];
    return {
      council: cell.council,
      councilName: c?.nameEn ?? cell.council,
      ...(issue.slug === "council-tax-2026-27"
        ? { bandDCouncilShare2026_27: f?.now ?? null, bandDCouncilShare2025_26: f?.before ?? null, changeOn2025_26: f?.change ?? null }
        : { latestDecision: cell.position ?? null }),
      status: state,
      date: item?.date ?? null,
      committeeKind: item?.committeeKind ?? null,
      itemTitle: item?.title ?? null,
      summaryEn: state === "summary" ? item!.summaryEn : null,
      summaryCy: state === "summary" ? item!.summaryCy : null,
      recordedDecision: item?.recorded ?? null,
      meetingPage: item ? `${SITE.url}/${cell.council}/meetings/${item.meetingId}` : null,
      councilPapers: item ? (item.sourceUrl ?? (c ? meetingUrl(c, item.meetingId) : null)) : null,
      laterMeetingPage: cell.later ? `${SITE.url}/${cell.council}/meetings/${cell.later.meetingId}` : null,
      checked: issue.checked,
    };
  });
}
