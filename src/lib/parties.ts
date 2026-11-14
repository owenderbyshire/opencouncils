import type { Locale } from "@/i18n/config";

/**
 * Parties on UK councils (the Welsh site's list, with Scottish and Northern Irish parties added). Councils record each councillor's party in their
 * own words; national parties are mapped to an ID (pipeline/sources/moderngov.ts)
 * for colour and a consistent name. Local groups keep the council's label.
 */
const NAMES: Record<string, { en: string; cy: string }> = {
  lab: { en: "Labour", cy: "Llafur" },
  con: { en: "Conservative", cy: "Ceidwadwyr" },
  pc: { en: "Plaid Cymru", cy: "Plaid Cymru" },
  ld: { en: "Liberal Democrat", cy: "Democratiaid Rhyddfrydol" },
  green: { en: "Green", cy: "Gwyrdd" },
  reform: { en: "Reform UK", cy: "Reform UK" },
  snp: { en: "SNP", cy: "SNP" },
  alba: { en: "Alba", cy: "Alba" },
  sf: { en: "Sinn Féin", cy: "Sinn Féin" },
  dup: { en: "DUP", cy: "DUP" },
  alliance: { en: "Alliance", cy: "Alliance" },
  uup: { en: "UUP", cy: "UUP" },
  sdlp: { en: "SDLP", cy: "SDLP" },
  tuv: { en: "TUV", cy: "TUV" },
  pbp: { en: "People Before Profit", cy: "People Before Profit" },
  ind: { en: "Independent", cy: "Annibynnol" },
};

/**
 * CSS colour for a party's data marks. Resolves to a light or dark variant via CSS variables.
 * Give the council's label too where there is one: a local group (no national party, but a
 * label) then takes the independent grey, as it does in the chamber diagrams.
 */
export function partyColour(id: string | null | undefined, label?: string | null): string {
  if (id && id in NAMES) return `var(--party-${id})`;
  const local = !!label?.trim() && label.trim() !== "No party recorded";
  return local ? "var(--party-ind)" : "var(--party-unknown)";
}

/** Whether an ID is one of the national parties, as opposed to an independent or a local group. */
export function isNationalParty(id: string | null | undefined): boolean {
  return Boolean(id && id in NAMES && id !== "ind");
}

/** A councillor's party: the national party's name, or the council's own label for local groups. */
export function partyName(locale: Locale, id: string | null | undefined, label: string | null | undefined): string {
  if (id && NAMES[id]) return NAMES[id][locale];
  return label || (locale === "cy" ? "Dim plaid wedi'i chofnodi" : "No party recorded");
}
