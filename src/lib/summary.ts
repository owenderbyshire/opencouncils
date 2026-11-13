/** The shape of a meeting summary as stored in `summaries.content`. Shared by the pipeline and the site. */
export interface MeetingSummaryContent {
  /** "preview": written from the agenda reports before the minutes are out, so it says what is proposed, not decided. */
  mode?: "minutes" | "preview";
  overviewEn: string;
  overviewCy: string;
  items: Array<{
    agendaItemId: number;
    headlineEn: string;
    headlineCy: string;
    /** Empty when the minute records no decision. */
    decidedEn: string;
    decidedCy: string;
    whyEn: string;
    whyCy: string;
    /** What the reports recommend, in a preview. */
    proposedEn?: string;
    proposedCy?: string;
    /** Document (attachment) IDs this item rests on. */
    sources: number[];
  }>;
}

/** A text split into sentences at full stops, question marks and exclamation marks. */
export function splitSentences(text: string | null | undefined): string[] {
  const t = (text ?? "").trim();
  return t ? t.split(/(?<=[.!?])\s+/) : [];
}

export interface SummaryMismatch {
  /** "overview", or the field and agenda item: "decided:1234". */
  field: string;
  en: number;
  cy: number;
}

/**
 * Places where a summary's English and Welsh don't carry the same number of
 * sentences. The two are written as translations of each other, so any
 * difference means one language has lost or gained something.
 */
export function summaryMismatches(s: MeetingSummaryContent): SummaryMismatch[] {
  const out: SummaryMismatch[] = [];
  const check = (field: string, en: string | null | undefined, cy: string | null | undefined) => {
    const e = splitSentences(en).length;
    const c = splitSentences(cy).length;
    if (e !== c) out.push({ field, en: e, cy: c });
  };
  check("overview", s.overviewEn, s.overviewCy);
  for (const it of s.items ?? []) {
    check(`headline:${it.agendaItemId}`, it.headlineEn ? "x." : "", it.headlineCy ? "x." : "");
    check(`decided:${it.agendaItemId}`, it.decidedEn, it.decidedCy);
    check(`why:${it.agendaItemId}`, it.whyEn, it.whyCy);
    check(`proposed:${it.agendaItemId}`, it.proposedEn, it.proposedCy);
  }
  return out;
}
