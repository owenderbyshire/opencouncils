/* No imports: the pipeline's emails use this file too. */
type Locale = "en" | "cy";

/**
 * Welsh names for the committees every council has, for councils that don't
 * publish their committee list in Welsh. Only whole names that mean the same
 * thing at every council are here; anything else keeps the council's own
 * English name, marked as English on Welsh pages.
 */
const WELSH: Array<[RegExp, string]> = [
  [/^(full |ordinary )?(meeting of (the )?)?(full |county |city |borough |county borough |city and county )?council( meeting)?$/, "Cyngor llawn"],
  [/^(the )?(annual (meeting of (the )?)?(county |city |borough |county borough )?council|(county |city |borough |county borough )?council (annual meeting|agm))$/, "Cyfarfod blynyddol y Cyngor"],
  [/^(extraordinary|special) (meeting of (the )?)?(full |county |city |borough |county borough )?council( meeting)?$/, "Cyfarfod arbennig o'r Cyngor llawn"],
  [/^(the )?cabinet( meeting)?$/, "Cabinet"],
  [/^planning committee$/, "Pwyllgor Cynllunio"],
  [/^licensing committee$/, "Pwyllgor Trwyddedu"],
  [/^licensing sub-committee$/, "Is-bwyllgor Trwyddedu"],
  [/^governance and audit committee$/, "Pwyllgor Llywodraethu ac Archwilio"],
  [/^audit and governance committee$/, "Pwyllgor Archwilio a Llywodraethu"],
  [/^audit committee$/, "Pwyllgor Archwilio"],
  [/^standards committee$/, "Pwyllgor Safonau"],
  [/^democratic services committee$/, "Pwyllgor Gwasanaethau Democrataidd"],
  [/^appointments committee$/, "Pwyllgor Penodiadau"],
  [/^scrutiny committee$/, "Pwyllgor Craffu"],
  [/^overview and scrutiny committee$/, "Pwyllgor Trosolwg a Chraffu"],
  [/^pensions? committee$/, "Pwyllgor Pensiynau"],
];

/** The Welsh name for a committee every council has, or null. */
export function welshCommitteeName(nameEn: string): string | null {
  const t = nameEn.toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ").trim();
  for (const [re, cy] of WELSH) if (re.test(t)) return cy;
  return null;
}

/**
 * A committee's name for the page's language: the council's own Welsh name
 * when it publishes one, otherwise a standard Welsh name where one exists,
 * otherwise the English name with `lang` set.
 */
export function committeeName(locale: Locale, nameEn: string | null | undefined, nameCy: string | null | undefined): { text: string; lang?: Locale } {
  if (locale === "cy" && !nameCy && nameEn) {
    const cy = welshCommitteeName(nameEn);
    if (cy) return { text: cy };
  }
  const [mine, other] = locale === "cy" ? [nameCy, nameEn] : [nameEn, nameCy];
  if (mine) return { text: mine };
  return { text: other ?? "", lang: other ? (locale === "cy" ? "en" : "cy") : undefined };
}
