/**
 * Topics that run across every council. An agenda item is filed under a topic
 * when its title, its recorded decision or its summary matches one of the
 * topic's patterns. Matching is by keyword, so it is predictable and free;
 * the site says so wherever topics appear.
 *
 * Patterns are tested against English text, lower-cased. Keep them specific:
 * a wrong match is worse than a missed one.
 */
export interface TopicDef {
  slug: string;
  en: string;
  cy: string;
  /** One plain sentence on what the topic covers. */
  noteEn: string;
  noteCy: string;
  patterns: RegExp[];
}

export const TOPICS: TopicDef[] = [
  {
    slug: "budget",
    en: "Budget and council tax",
    cy: "Cyllideb a'r dreth gyngor",
    noteEn: "How the council raises and spends its money, including council tax and savings.",
    noteCy: "Sut mae'r cyngor yn codi ac yn gwario ei arian, gan gynnwys y dreth gyngor ac arbedion.",
    patterns: [/\bbudget/, /council tax/, /medium[- ]term financial/, /\bcapital programme/, /\brevenue (monitoring|outturn|budget)/, /\bfees and charges\b/, /\bsavings proposals?\b/, /\btreasury management\b/],
  },
  {
    slug: "housing",
    en: "Housing",
    cy: "Tai",
    noteEn: "Council homes, social and affordable housing, homelessness and private renting.",
    noteCy: "Tai cyngor, tai cymdeithasol a fforddiadwy, digartrefedd a rhentu preifat.",
    patterns: [/\bhousing\b/, /\bhomeless/, /\baffordable homes?\b/, /\bcouncil homes?\b/, /\btenan(t|cy)/, /\bhouses in multiple occupation\b|\bhmos?\b/, /\bempty homes?\b/, /\brent (setting|increase)/],
  },
  {
    slug: "schools",
    en: "Schools and education",
    cy: "Ysgolion ac addysg",
    noteEn: "Schools, school places and buildings, additional learning needs and Welsh-medium education.",
    noteCy: "Ysgolion, lleoedd ysgol ac adeiladau, anghenion dysgu ychwanegol ac addysg cyfrwng Cymraeg.",
    patterns: [/\bschools?\b/, /\beducation\b/, /\badditional learning needs\b|\baln\b/, /\bwelsh[- ]medium\b/, /\bschool organisation\b/, /\bsustainable communities for learning\b/, /\bpupils?\b/, /\bestyn\b/],
  },
  {
    slug: "planning",
    en: "Planning and development",
    cy: "Cynllunio a datblygu",
    noteEn: "Planning applications, the local development plan and what can be built where.",
    noteCy: "Ceisiadau cynllunio, y cynllun datblygu lleol a beth all gael ei adeiladu ble.",
    patterns: [/\bplanning application/, /\blocal development plan\b|\bldp\b/, /\bsection 106\b|\bs106\b/, /\breplacement local development plan\b/, /\bapplication (no|number)\b/, /\boutline (planning )?permission\b/, /\bconservation area\b/, /\bdevelopment management\b/],
  },
  {
    slug: "social-care",
    en: "Social care",
    cy: "Gofal cymdeithasol",
    noteEn: "Care for older and disabled people, children's services and safeguarding.",
    noteCy: "Gofal i bobl hŷn a phobl anabl, gwasanaethau plant a diogelu.",
    patterns: [/\bsocial (care|services)\b/, /\bchildren'?s services\b/, /\bsafeguarding\b/, /\bcare homes?\b/, /\bdomiciliary care\b/, /\blooked after children\b|\bchildren looked after\b/, /\bfoster/, /\badult services\b/],
  },
  {
    slug: "transport",
    en: "Roads and transport",
    cy: "Ffyrdd a thrafnidiaeth",
    noteEn: "Roads, potholes, parking, buses, cycling, walking and speed limits.",
    noteCy: "Ffyrdd, tyllau, parcio, bysiau, beicio, cerdded a chyfyngiadau cyflymder.",
    patterns: [/\bhighways?\b/, /\btransport\b/, /\bparking\b/, /\bbus(es)?\b/, /\bcycl(e|ing)\b/, /\bactive travel\b/, /\b20 ?mph\b/, /\btraffic\b/, /\broads?\b/, /\bpotholes?\b/],
  },
  {
    slug: "waste",
    en: "Waste and recycling",
    cy: "Gwastraff ac ailgylchu",
    noteEn: "Bin collections, recycling, household waste sites, litter and fly-tipping.",
    noteCy: "Casgliadau biniau, ailgylchu, safleoedd gwastraff y cartref, sbwriel a thipio anghyfreithlon.",
    patterns: [/\bwaste\b/, /\brecycl/, /\bbins?\b/, /\blitter\b/, /\bfly[- ]?tipping\b/, /\bstreet cleansing\b/],
  },
  {
    slug: "climate",
    en: "Climate and nature",
    cy: "Hinsawdd a natur",
    noteEn: "Climate change, net zero, flooding, energy, biodiversity, parks and green spaces.",
    noteCy: "Newid hinsawdd, sero net, llifogydd, ynni, bioamrywiaeth, parciau a mannau gwyrdd.",
    patterns: [/\bclimate\b/, /\bnet zero\b|\bcarbon\b/, /\bflood/, /\bbiodiversity\b/, /\bdecarboni[sz]/, /\brenewable\b|\bsolar\b/, /\bparks?\b/, /\bgreen spaces?\b/, /\btrees?\b/, /\bnature\b/],
  },
  {
    slug: "economy",
    en: "Economy and town centres",
    cy: "Yr economi a chanol trefi",
    noteEn: "Jobs, business support, regeneration, town and city centres and tourism.",
    noteCy: "Swyddi, cymorth i fusnesau, adfywio, canol trefi a dinasoedd a thwristiaeth.",
    patterns: [/\bregeneration\b/, /\btown cent(re|er)s?\b|\bcity cent(re|er)\b/, /\beconom(y|ic)\b/, /\bshared prosperity\b/, /\bcity deal\b/, /\btourism\b/, /\bbusiness (rates|support)\b/, /\bemployment\b/],
  },
  {
    slug: "leisure-culture",
    en: "Leisure, libraries and culture",
    cy: "Hamdden, llyfrgelloedd a diwylliant",
    noteEn: "Leisure centres, libraries, museums, arts, events and the Welsh language.",
    noteCy: "Canolfannau hamdden, llyfrgelloedd, amgueddfeydd, y celfyddydau, digwyddiadau a'r Gymraeg.",
    patterns: [/\bleisure\b/, /\blibrar(y|ies)\b/, /\bmuseums?\b/, /\barts?\b/, /\bmajor events\b|\bevents (programme|strategy)\b/, /\bwelsh language\b/, /\bsport(s)?\b/, /\bswimming\b/],
  },
  {
    slug: "community-safety",
    en: "Community safety and licensing",
    cy: "Diogelwch cymunedol a thrwyddedu",
    noteEn: "Licences for pubs, taxis and events, anti-social behaviour and trading standards.",
    noteCy: "Trwyddedau ar gyfer tafarndai, tacsis a digwyddiadau, ymddygiad gwrthgymdeithasol a safonau masnach.",
    patterns: [/\blicen[cs]/, /\btaxi\b|\bhackney\b|\bprivate hire\b/, /\bcommunity safety\b/, /\banti[- ]social\b/, /\btrading standards\b/, /\bpublic spaces protection order\b/],
  },
  {
    slug: "council-running",
    en: "How the council is run",
    cy: "Sut mae'r cyngor yn cael ei redeg",
    noteEn: "The constitution, councillors' conduct, audit, performance and complaints.",
    noteCy: "Y cyfansoddiad, ymddygiad cynghorwyr, archwilio, perfformiad a chwynion.",
    patterns: [/\bconstitution\b/, /\bcode of conduct\b/, /\baudit\b/, /\bcorporate plan\b/, /\bperformance (report|monitoring)\b/, /\bcomplaints?\b/, /\bself[- ]assessment\b/, /\bstandards committee\b/],
  },
];

export const TOPIC_BY_SLUG = new Map(TOPICS.map((t) => [t.slug, t]));

/** Procedural agenda items that never get a topic. */
const PROCEDURAL =
  /^(apologies|declarations? of interest|minutes|approval of (the )?minutes|confirmation of minutes|exclusion of (the )?(press|public)|urgent (business|items?)|any other business|chair'?s announcements?|forward work programme|work programme|date of next meeting|public questions)\b/i;

/** The topics a piece of council business belongs to. */
export function topicsFor(title: string, ...more: Array<string | null | undefined>): string[] {
  if (PROCEDURAL.test(title.trim())) return [];
  const text = [title, ...more].filter(Boolean).join(" \n ").toLowerCase();
  return TOPICS.filter((t) => t.patterns.some((p) => p.test(text))).map((t) => t.slug);
}
