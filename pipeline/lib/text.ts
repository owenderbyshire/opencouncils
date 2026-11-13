/**
 * Text helpers shared by the parsers. The Record publishes speech text as small
 * HTML fragments; we store plain text with blank lines between paragraphs, which
 * is safe to render, easy to search and easy to quote.
 */

const NAMED: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  pound: "£",
  euro: "€",
  middot: "·",
  bull: "•",
  shy: "",
  zwj: "",
  zwnj: "",
  // Welsh letters occasionally arrive as named entities.
  wcirc: "ŵ",
  Wcirc: "Ŵ",
  ycirc: "ŷ",
  Ycirc: "Ŷ",
  acirc: "â",
  ecirc: "ê",
  icirc: "î",
  ocirc: "ô",
  ucirc: "û",
  Acirc: "Â",
  Ecirc: "Ê",
  Icirc: "Î",
  Ocirc: "Ô",
  Ucirc: "Û",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  agrave: "à",
  egrave: "è",
  igrave: "ì",
  ograve: "ò",
  ugrave: "ù",
  auml: "ä",
  euml: "ë",
  iuml: "ï",
  ouml: "ö",
  uuml: "ü",
  yuml: "ÿ",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code =
        e[1] === "x" || e[1] === "X"
          ? Number.parseInt(e.slice(2), 16)
          : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : m;
    }
    return NAMED[e] ?? NAMED[e.toLowerCase()] ?? m;
  });
}

/** Converts a Record HTML fragment to plain text paragraphs. */
export function htmlToText(html: string): string {
  if (!html) return "";
  let s = html;
  // Drop the "view the vote result" link blocks and any scripts/styles.
  s = s.replace(/<div class="voteResultLinkContainer"[\s\S]*?<\/div>/gi, "");
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  // Structural breaks.
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<li[^>]*>/gi, "\n• ");
  s = s.replace(/<\/(p|div|li|h[1-6]|tr|table|ul|ol|blockquote)>/gi, "\n\n");
  s = s.replace(/<\/t[dh]>/gi, "\t");
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  // Normalise whitespace inside paragraphs, keep paragraph breaks.
  const paras = s
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .split("\n")
        .map((line) => line.replace(/[ \t ]+/g, " ").trim())
        .filter(Boolean)
        .join("\n"),
    )
    .filter(Boolean);
  return paras.join("\n\n");
}

export function wordCount(text: string): number {
  if (!text) return 0;
  const m = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return m ? m.length : 0;
}

/*
 * Common function words of each language that are not words in the other
 * (so not "a", "i", "o" or "am", and not "eu" or "ni", which English text
 * uses as abbreviations). Names such as "Dŵr Cymru" are content words and
 * aren't counted.
 */
const WELSH_WORDS = new Set(
  "y yr yn mae mae'r ein ei gyda wedi bod fod sydd sy'n hefyd ond nid ddim drwy trwy rydym rydyn byddwn bydd fydd ydy oes hyn hynny hwn hon gan fel ar ac a'r i'r o'r yng mewn neu dros rhwng ynghylch gyfer nhw iawn felly oherwydd eisoes cael gael pob".split(
    " ",
  ),
);
const ENGLISH_WORDS = new Set(
  "the and of to is that for are with we have this be will has on in it as by from which been an or not their our was were these those would should could".split(
    " ",
  ),
);

/**
 * Whether a text is clearly Welsh or clearly English, judged by how many of
 * its words are function words of each language. Deliberately cautious: it
 * needs at least 8 such words from one language, four times as many as from
 * the other, making up a tenth of the text. Anything less (short or mixed
 * texts) gives null, and callers keep the text where the source put it.
 */
export function textLanguage(
  text: string | null | undefined,
): "en" | "cy" | null {
  const words =
    (text ?? "")
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .match(/[\p{L}][\p{L}']*/gu) ?? [];
  let cy = 0;
  let en = 0;
  for (const w of words) {
    if (WELSH_WORDS.has(w)) cy++;
    else if (ENGLISH_WORDS.has(w)) en++;
  }
  const enough = (n: number, other: number) =>
    n >= 8 && n >= 4 * other && n >= words.length / 10;
  if (enough(cy, en)) return "cy";
  if (enough(en, cy)) return "en";
  return null;
}

/** Lowercase, strip diacritics and punctuation: for name matching only. */
export function foldName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(
      /\b(ms|as|am|ac|mp|mbe|obe|cbe|kc|qc|dr|prof|professor|rt hon|the rt hon|cllr)\b\.?/g,
      " ",
    )
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/[-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const NICKNAMES: string[][] = [
  ["thomas", "tom", "tommy"],
  ["rebecca", "becca", "becky"],
  ["arthur", "art", "arty"],
  ["samuel", "sam", "sammy"],
  ["joseph", "joe"],
  ["michael", "mike", "mick"],
  ["william", "will", "bill", "billy"],
  ["robert", "rob", "bob", "robbie"],
  ["elizabeth", "liz", "lizzie", "beth"],
  ["jonathan", "jon", "jonny"],
  ["christopher", "chris"],
  ["daniel", "dan", "danny"],
  ["andrew", "andy"],
  ["peter", "pete"],
  ["richard", "rich"],
  ["catherine", "cath", "kate", "katherine", "kathryn"],
  ["stephen", "steve", "steven"],
  ["alexander", "alex"],
  ["nicholas", "nick"],
  ["edward", "ed", "ted"],
  ["matthew", "matt"],
  ["benjamin", "ben"],
  ["david", "dave", "dai"],
  ["jennifer", "jenny", "jen"],
  ["deborah", "debbie", "debs"],
  ["susan", "sue"],
  ["anthony", "tony"],
  ["gwenllian", "gwen"],
];
const NICK_CANON = new Map<string, string>();
for (const group of NICKNAMES)
  for (const n of group) NICK_CANON.set(n, group[0]);

/**
 * Keys under which a person's name can be matched across sources that spell
 * it differently ("Tom Montgomery" / "Thomas Montgomery", "Andrew R.T. Davies"
 * / "Andrew RT Davies"). The first key is the most specific.
 */
export function nameKeys(name: string): string[] {
  const folded = foldName(name.replace(/\./g, ""));
  const parts = folded.split(" ").filter(Boolean);
  if (parts.length === 0) return [];
  const keys = new Set<string>([parts.join(" ")]);
  const first = NICK_CANON.get(parts[0]) ?? parts[0];
  const last = parts[parts.length - 1];
  keys.add([first, ...parts.slice(1)].join(" "));
  if (parts.length > 2) {
    keys.add(`${parts[0]} ${last}`);
    keys.add(`${first} ${last}`);
  }
  return [...keys];
}
