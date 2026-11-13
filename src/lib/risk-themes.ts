/**
 * The themes a council's risks are grouped into, by the words
 * in each risk's statement. The words are published on the page, so a
 * reader can see exactly what was counted. A risk that touches two themes
 * counts under both; one that matches none is "other". Safe to import
 * anywhere.
 *
 * Copied from Edau (owenderbyshire/edau, src/lib/risk-themes.ts) so the two
 * group risks the same way; never imported from it.
 */
export type RiskTheme = {
  key: string;
  nameEn: string;
  nameCy: string;
  /** Matched as whole words, ignoring case, in the English statement. A trailing * matches the rest of the word. */
  terms: string[];
};

export const RISK_THEMES: RiskTheme[] = [
  { key: "money", nameEn: "Money and budgets", nameCy: "Arian a chyllidebau", terms: ["budget*", "financial*", "finance*", "funding", "deficit", "savings", "overspend*", "cash", "cost pressure*", "cost*", "income", "reserves", "afford*", "underfund*", "break even", "breakeven", "claim*", "liabilit*", "pay award*", "inflation"] },
  { key: "workforce", nameEn: "Workforce", nameCy: "Gweithlu", terms: ["workforce", "staff*", "recruit*", "retention", "vacanc*", "sickness", "agency", "locum*", "industrial action", "strike*", "skills shortage*", "training", "morale", "wellbeing of staff", "resourcing", "resource*", "turnover", "succession", "leadership capacity", "trainer*"] },
  { key: "demand", nameEn: "Demand, waiting and performance", nameCy: "Galw, aros a pherfformiad", terms: ["waiting", "waits", "waiting list*", "waiting time*", "demand", "backlog*", "capacity", "performance", "performance target*", "referral*", "delay*", "throughput", "bed*", "occupancy", "ambulance*", "handover*"] },
  { key: "cyber", nameEn: "Cyber security, data and IT", nameCy: "Seiberddiogelwch, data a TG", terms: ["cyber*", "information governance", "data breach*", "data protection", "ransomware", "IT system*", "IT infrastructure", "digital", "GDPR", "software", "network outage*", "system failure*"] },
  { key: "estates", nameEn: "Buildings, estates and equipment", nameCy: "Adeiladau, ystadau ac offer", terms: ["estate*", "building*", "maintenance", "RAAC", "asbestos", "fire safety", "infrastructure", "accommodation", "facilities", "equipment", "backlog maintenance", "condition of", "premises", "fleet"] },
  { key: "safety", nameEn: "Safety, quality and safeguarding", nameCy: "Diogelwch, ansawdd a diogelu", terms: ["safeguard*", "patient safety", "safety", "harm", "quality of care", "infection*", "never event*", "child protection", "adult protection", "serious incident*", "clinical risk*", "mortality", "abuse", "neglect"] },
  { key: "climate", nameEn: "Climate, flooding and environment", nameCy: "Hinsawdd, llifogydd a'r amgylchedd", terms: ["climate*", "flood*", "net zero", "carbon", "environment*", "biodiversity", "weather", "decarbonis*", "pollution", "emissions", "energy"] },
  { key: "governance", nameEn: "Governance, law and compliance", nameCy: "Llywodraethu, y gyfraith a chydymffurfio", terms: ["governance", "compliance", "regulat*", "legal", "statutory", "audit*", "assurance", "fraud", "procurement", "litigation", "legislation", "statutory dut*", "inspection*", "judicial review", "standard*", "accountab*", "controls", "policies", "change control"] },
  { key: "delivery", nameEn: "Delivery of plans and projects", nameCy: "Cyflawni cynlluniau a phrosiectau", terms: ["delivery of", "delivery plan*", "programme*", "project*", "transformation", "timescale*", "timetable*", "contract*", "supplier*", "milestone*", "implementation", "business case*", "slippage"] },
  { key: "partners", nameEn: "Partnerships and reputation", nameCy: "Partneriaethau ac enw da", terms: ["partnership*", "partner*", "reputation*", "engagement", "communication*", "public confidence", "stakeholder*", "relationship*", "collaboration", "media"] },
];

/** A theme's name in the reader's language; "Other" for risks that match no theme's words. */
export function themeName(locale: "en" | "cy", key: string): string {
  const t = RISK_THEMES.find((x) => x.key === key);
  return t ? (locale === "cy" ? t.nameCy : t.nameEn) : locale === "cy" ? "Arall" : "Other";
}

const compiled = RISK_THEMES.map((t) => ({
  key: t.key,
  re: new RegExp(`\\b(${t.terms.map((w) => w.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*$/, "\\w*")).join("|")})\\b`, "i"),
}));

/** The themes a risk statement falls under, in the published order; empty when none of the words appear. */
export function riskThemesOf(statement: string): string[] {
  return compiled.filter((c) => c.re.test(statement)).map((c) => c.key);
}
