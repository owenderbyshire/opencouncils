/**
 * Agenda items as people want to see them: without the routine items every
 * meeting has, and without titles shouted in capitals.
 */

const ROUTINE =
  /^(apolog|ymddiheur|attendance and apologies|declaration|disclosures? of|datgan|minutes?\b|cofnod|to (approve|confirm|receive|sign)\b.*\b(minutes|record)|urgent|any other business|exclusion|gwahardd|announcements?|cyhoeddiadau|chair'?s?\b|(vice[- ]?)?chair(man|person)?\b|is-?gadeirydd|cadeirydd|elect(ion of)?\b|forward work ?programme|work ?programme|rhaglen waith|date of (the )?next|matters arising|welcome|croeso|introductions?|items? (for|of) (urgent|information|deferral|withdrawal)|part (\d+|[a-d]|[ivx]+)\b|rhan (\d+|[a-d])\b|access to meetings|simultaneous translation|cyfieithu|live event|webcast|livestream|presenoldeb|action (sheet|log|tracker)|housekeeping|exempt|confidential|to note the|scrutiny adviser|questions? (from|by) (the )?public\b|public questions?|public (open )?forum|agenda\.?$|agenda (and|&) (reports|papers)$)/i;

const ROUTINE_ANYWHERE =
  /\b(declarations? of (personal|prejudicial )?(and prejudicial )?interests?|to (approve|confirm|sign)( as a correct record)? the (minutes|decision record)|approval of (the )?minutes|exclusion of (the )?(press and )?public|urgent (items|business|matters)|forward work ?programme)\b/i;

/** Strips "1.", "Item 4 -", "4a)" from the front of a title. */
export function stripNumber(title: string): string {
  return title
    .trim()
    // Not the start of a reference such as "25/02001/FUL", a year such as
    // "2026-27 Budget" or an address such as "10-12 High Street".
    .replace(/^(item\s+)?\d{1,3}[a-z]?(\.\d+)?(?![\d/])(?!\s*[-–/]\s*\d)[.):]?\s*[-–:]?\s*/i, "")
    .trim();
}

/** Routine items that every meeting has and that don't tell anyone what the meeting is about. */
export function isRoutineItem(title: string): boolean {
  const t = stripNumber(title);
  return !t || ROUTINE.test(t) || ROUTINE_ANYWHERE.test(t);
}

const SMALL = new Set("a an and as at by for from in into of on or the to with via under over per vs".split(" "));

/**
 * A title in capitals given ordinary capitals ("QUESTION FROM COUNCILLOR
 * TYSSUL EVANS" to "Question from Councillor Tyssul Evans"). Each word gets a
 * capital so names stay right; small words don't; two-letter words and short
 * words in brackets stay in capitals, as they are usually abbreviations.
 * Mixed-case titles are left alone.
 */
export function tidyTitle(title: string): string {
  // A lone full stop at the end ("Public Open Forum.") reads badly when titles are joined.
  const t = stripNumber(title)
    .replace(/\s+/g, " ")
    .replace(/(?<![.\s][A-Za-z])\.$/, "");
  const letters = t.replace(/[^A-Za-z]/g, "");
  if (letters.length < 6 || letters !== letters.toUpperCase()) return t;
  let inBrackets = false;
  return t
    .split(" ")
    .map((w, i) => {
      const opens = w.startsWith("(");
      if (opens) inBrackets = true;
      const bare = w.replace(/[^A-Za-z]/g, "");
      let out: string;
      // References and codes ("25/02001/FUL", "2026/27") stay as written.
      if (/\d/.test(w)) out = w;
      else if (bare.length === 2 && !SMALL.has(bare.toLowerCase()) && !/^(IS|IT|BE|WE|HE|NO|SO|UP|US|MY|DO|GO|IF)$/.test(bare)) out = w;
      else if (inBrackets && bare.length <= 5) out = w;
      else if (i > 0 && SMALL.has(bare.toLowerCase())) out = w.toLowerCase();
      else out = w.toLowerCase().replace(/(^|[-'(/])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
      if (w.endsWith(")")) inBrackets = false;
      return out;
    })
    .join(" ");
}

/**
 * Raw minute text made easier to read: letters spaced out for emphasis
 * ("T H A T") joined up again. Nothing else changes.
 */
export function tidyMinute(text: string): string {
  return text.replace(/\b[A-Z](?: [A-Z]){2,}\b/g, (m) => m.replace(/ /g, ""));
}

/**
 * Entries in a council's meeting calendar that aren't meetings: weekly lists
 * of planning applications, and lists or notices of decisions taken by
 * officers or single Cabinet members outside a meeting.
 */
export function isNotAMeeting(committee: string): boolean {
  return /\b(weekly|lists?|delegated (decisions?|powers)|decision notices?|officer decisions?|(individual|single) (cabinet )?member decisions?)\b/i.test(committee);
}
