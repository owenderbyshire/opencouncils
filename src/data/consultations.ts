import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ukToday } from "@/i18n/format";
import { rows, sql } from "./db";

/**
 * Open public consultations (pipeline/jobs/consultations.ts): the Welsh
 * Government's, and councils' own where we can read them.
 */

export interface ConsultationRow {
  url: string;
  urlCy: string | null;
  source: string;
  councilId: string | null;
  typeEn: string | null;
  titleEn: string;
  titleCy: string | null;
  summaryEn: string | null;
  summaryCy: string | null;
  area: string | null;
  opens: string | null;
  closes: string | null;
  topics: string[];
  /** A Welsh Government consultation about councils or the services they run. */
  aboutCouncils: boolean;
}

const ABOUT_COUNCILS = sql`(c.source <> 'gov' or c.area ilike '%local government%'
  or c.title_en ~* '\\m(council|councils|councillors?|local authorit|local government|local tax|non-domestic rates|business rates|planning|social care|schools?|waste|recycling|homelessness|social housing|highways|licensing|libraries)'
  or c.summary_en ~* '\\m(council|councils|councillors?|local authorit|local government|local tax|non-domestic rates|business rates|planning|social care|schools?|waste|recycling|homelessness|social housing|highways|licensing|libraries)')`;

/** Everything still open, closing soonest first. */
export async function openConsultations(): Promise<ConsultationRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("consultations");
  const today = ukToday();
  return rows<ConsultationRow>(sql`
    select c.url, c.url_cy as "urlCy", c.source, c.council_id as "councilId", c.type_en as "typeEn",
      c.title_en as "titleEn", c.title_cy as "titleCy", c.summary_en as "summaryEn", c.summary_cy as "summaryCy",
      c.area, c.opens::text as opens, c.closes::text as closes, c.topics, ${ABOUT_COUNCILS} as "aboutCouncils"
    from consultations c
    where c.open and (c.closes is null or c.closes >= ${today}::date)
    order by c.closes nulls last, c.title_en`);
}
