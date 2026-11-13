/**
 * A rough check of whether a short text is Welsh or English, from its
 * commonest small words. For catching a summary field written in the wrong
 * language, not for anything finer.
 */
const CY = new Set("y yr a ac ar am i o yn ei eu gan gyda mae sy sydd ddim wedi bod hyn hynny ac gyfer ar gyfer i'r o'r yng ym nghymru cyngor prynu adroddiad cynllun penderfynu cymeradwyo".split(" "));
const EN = new Set("the of and to for in on with is was by from at as an be this that are were has have it council report plan approve approved agreed buying".split(" "));

export function languageOf(text: string): "cy" | "en" | null {
  const words = text.toLowerCase().replace(/[^a-zâêîôûŵŷäëïöüẅÿáéíóúẃýàèìòùẁỳ' ]+/g, " ").split(/\s+/).filter(Boolean);
  let cy = 0;
  let en = 0;
  for (const w of words) {
    if (CY.has(w)) cy++;
    if (EN.has(w)) en++;
    if (/[ŵŷâ]/.test(w) || /^(ll|ff|dd|rh)/.test(w) || /dd|ll|wy|ae|ch/.test(w) && !/^(the|and|which|each|much|such|church|change|charge|school)$/.test(w)) cy += 0.25;
  }
  if (cy === 0 && en === 0) return null;
  if (cy >= en * 2 && cy >= 1) return "cy";
  if (en >= cy * 2 && en >= 1) return "en";
  return null;
}

/** An English and a Welsh field the right way round: swapped when each is plainly in the other's language. */
export function rightWayRound(en: string, cy: string): { en: string; cy: string; swapped: boolean } {
  if (languageOf(en) === "cy" && languageOf(cy) === "en") return { en: cy, cy: en, swapped: true };
  return { en, cy, swapped: false };
}
