/**
 * Which topics a Cabinet portfolio is listed under, from the words in the
 * council's own name for it. "Cabinet Member for Housing and Planning" is
 * listed under Housing and under Planning and development, because its name
 * says so.
 *
 * Councils name and combine portfolios differently, so this only decides
 * where a role is listed: the site always shows the council's own wording.
 * The rules are deliberately narrow. A word is here only when it means the
 * same thing in every council that uses it; "Resources" is not, because one
 * council's Resources portfolio holds the budget and another's does not. A
 * portfolio whose name has none of these words is listed under its council
 * alone. The method note on the site shows these same words (`words`), so
 * keep them in step with the patterns.
 *
 * Patterns are tested against the wording lower-cased, with "&" as "and".
 */
import { withoutGroupRoles } from "../../src/lib/cabinet";

export interface PortfolioTopicRule {
  topic: string;
  /** The words a reader is shown in the method note. They are English because councils' English names are what is read. */
  words: string[];
  /** Phrases with one of those words in them that do not count. */
  not?: string[];
  patterns: RegExp[];
}

export const PORTFOLIO_TOPIC_RULES: PortfolioTopicRule[] = [
  {
    topic: "budget",
    words: ["finance", "financial", "budget", "council tax"],
    patterns: [/\bfinanc(?:e|es|ial)\b/, /\bbudgets?\b/, /\bcouncil tax\b/],
  },
  {
    topic: "housing",
    words: ["housing", "homes", "homelessness"],
    patterns: [/\bhousing\b/, /\bhomes\b/, /\bhomeless/],
  },
  {
    topic: "schools",
    words: ["education", "schools", "learning"],
    patterns: [/\beducation\b/, /\bschools?\b/, /\blearning\b/],
  },
  {
    topic: "planning",
    words: ["planning"],
    not: ["emergency planning", "financial planning", "business planning", "workforce planning"],
    patterns: [/(?<!\b(?:emergency|financial|business|workforce|service|corporate|succession|family) )\bplanning\b/],
  },
  {
    topic: "social-care",
    words: ["social care", "social services", "care", "caring", "adults", "children", "safeguarding"],
    patterns: [/\bsocial (?:care|services)\b/, /\bcar(?:e|ing)\b/, /\badults?\b/, /\bchildren(?:['’]s)?\b/, /\bsafeguarding\b/],
  },
  {
    topic: "transport",
    words: ["transport", "highways", "roads", "parking", "active travel"],
    patterns: [/\btransport\b/, /\bhighways?\b/, /\broads?\b/, /\bparking\b/, /\bactive travel\b/],
  },
  {
    topic: "waste",
    words: ["waste", "recycling", "streetscene"],
    patterns: [/\bwaste\b/, /\brecycling\b/, /\bstreet ?scene\b/],
  },
  {
    topic: "climate",
    words: ["climate", "carbon", "decarbonisation", "net zero", "nature", "biodiversity", "environment", "greener", "energy", "sustainability", "parks", "countryside", "flooding"],
    not: ["financial sustainability"],
    patterns: [
      /\bclimate\b/,
      /\bcarbon\b/,
      /\bdecarboni[sz]ation\b/,
      /\bnet zero\b/,
      /\bnature\b/,
      /\bbiodiversity\b/,
      /\benvironment\b/,
      /\bgreen(?:er)?\b/,
      /\benergy\b/,
      /(?<!\bfinancial )\bsustainability\b/,
      /\bparks?\b/,
      /\bcountryside\b/,
      /\bflood/,
    ],
  },
  {
    topic: "economy",
    words: ["economy", "economic", "regeneration", "tourism", "business", "employment", "growth", "prosperous", "town centres"],
    not: ["council business", "corporate business"],
    patterns: [/\beconom(?:y|ic)\b/, /\bregeneration\b/, /\btourism\b/, /(?<!\b(?:council|corporate) )\bbusiness\b/, /\bemployment\b/, /\bgrowth\b/, /\bprosperous\b/, /\btown cent(?:re|er)s?\b/],
  },
  {
    topic: "leisure-culture",
    words: ["leisure", "culture", "libraries", "arts", "sport", "Welsh language", "heritage", "museums", "events"],
    patterns: [/\bleisure\b/, /\bcultur(?:e|al)\b/, /\blibrar(?:y|ies)\b/, /\barts\b/, /\bsports?\b/, /\bwelsh language\b/, /\bheritage\b/, /\bmuseums?\b/, /\bevents\b/],
  },
  {
    topic: "community-safety",
    words: ["community safety", "public protection", "licensing", "regulatory", "safer"],
    patterns: [/\bcommunity safety\b/, /\bpublic protection\b/, /\blicensing\b/, /\bregulatory\b/, /\bsafer\b/],
  },
  {
    topic: "council-running",
    words: ["governance", "performance", "audit", "corporate", "legal", "democratic services", "modernisation", "transformation", "council business", "human resources", "organisation", "workforce"],
    patterns: [
      /\bgovernance\b/,
      /\bperformance\b/,
      /\baudit\b/,
      /\bcorporate\b/,
      /\blegal\b/,
      /\bdemocratic services\b/,
      /\bmodernisation\b/,
      /\btransformation\b/,
      /\bcouncil business\b/,
      /\bhuman resources\b/,
      /\borganisation(?:al)?\b/,
      /\bworkforce\b/,
    ],
  },
];

/** The topics a portfolio is listed under, from its name in the council's words. Empty when its name fits none. */
export function portfolioTopics(...wording: string[]): string[] {
  // A political group's own posts in the same line ("Leader of the Labour Group, …") say nothing about the portfolio.
  const text = wording
    .map(withoutGroupRoles)
    .join(" ; ")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ");
  return PORTFOLIO_TOPIC_RULES.filter((r) => r.patterns.some((p) => p.test(text))).map((r) => r.topic);
}
