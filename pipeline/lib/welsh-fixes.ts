/**
 * Corrections for slips the summary model has made in Welsh. Each one is an
 * exact phrase that is always wrong, with the form that is always right, so
 * applying them can't change the meaning of a correct sentence. The prompt
 * asks the model not to make these mistakes; this catches the ones it still
 * makes, in new summaries and (through the `welsh-fixes` job) stored ones.
 *
 * Add a phrase here only when it can never be correct Welsh.
 */
const FIXES: Array<[RegExp, string]> = [
  // "Cais" (application) is masculine: tri chais, dau gais.
  [/\b([Tt])air (?:c|ch)ais\b/g, "$1ri chais"],
  [/\b([Dd])wy (?:c|g)ais\b/g, "$1au gais"],
  // The same after a soft mutation ("cymeradwyodd dri chais").
  [/\b([Dd])air (?:c|ch|g)ais\b/g, "$1ri chais"],
  [/\b([Dd])dwy (?:c|g)ais\b/g, "$1dau gais"],
  // "A" (and) becomes "ac" before a vowel. "Estyniad" is a noun, so "a" here can only mean "and".
  [/\b([Aa]) estyniad/g, "$1c estyniad"],
  // A repeated syllable.
  [/\b([Ss])efsefyllfa/g, "$1efyllfa"],
];

/** The text with known Welsh slips corrected, and how many were corrected. */
export function fixWelsh(text: string): { text: string; fixed: number } {
  let fixed = 0;
  let out = text;
  for (const [re, to] of FIXES)
    out = out.replace(re, (...m) => {
      const replaced = m[0].replace(new RegExp(re.source), to);
      if (replaced !== m[0]) fixed++;
      return replaced;
    });
  return { text: out, fixed };
}
