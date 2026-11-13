/**
 * Welsh mutations needed when the site joins generated text, such as month
 * names after "i" ("Ebrill i Fehefin 2026"). Kept deliberately narrow: only
 * words we know take the mutation are changed.
 */

const MONTH_SOFT: Record<string, string> = {
  Mawrth: "Fawrth",
  Mai: "Fai",
  Mehefin: "Fehefin",
  Gorffennaf: "Orffennaf",
  Medi: "Fedi",
  Tachwedd: "Dachwedd",
  Rhagfyr: "Ragfyr",
};

/** Soft mutation of a Welsh month name at the start of a phrase. Anything else (numbers, "y flwyddyn...") is returned unchanged. */
export function softMutateMonth(text: string): string {
  const m = /^(\S+)([\s\S]*)$/.exec(text);
  if (!m) return text;
  const mutated = MONTH_SOFT[m[1]];
  return mutated ? `${mutated}${m[2]}` : text;
}

/**
 * Soft mutation of the first letter of a Welsh word or place name, as after
 * "dros", "i", "o" and "ar": Caerdydd → Gaerdydd, Bangor → Fangor, Gwynedd →
 * Wynedd, Llanelli → Lanelli. Digraphs that don't mutate (ch, dd, ff, ng, ph,
 * th) and other letters are left alone. Use only on Welsh text.
 */
export function softMutate(text: string): string {
  const m = /^(\S)(\S?)/.exec(text);
  if (!m) return text;
  const pair = (m[1] + m[2]).toLowerCase();
  if (["ch", "dd", "ff", "ng", "ph", "th"].includes(pair)) return text;
  const keepCase = (s: string) =>
    m[1] === m[1].toUpperCase() ? s.toUpperCase() : s;
  if (pair === "ll") return `${keepCase("l")}${text.slice(2)}`;
  if (pair === "rh") return `${keepCase("r")}${text.slice(2)}`;
  const map: Record<string, string> = {
    p: "b",
    t: "d",
    c: "g",
    b: "f",
    d: "dd",
    m: "f",
  };
  const first = m[1].toLowerCase();
  if (first === "g") {
    const rest = text.slice(1);
    return m[1] === "G" && rest ? rest[0].toUpperCase() + rest.slice(1) : rest;
  }
  const to = map[first];
  if (!to) return text;
  const mutated =
    m[1] === m[1].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to;
  return mutated + text.slice(1);
}

/**
 * "a" (and) before a place name, with the aspirate mutation: a Chaerdydd,
 * a Phowys, a Thorfaen, a Merthyr Tudful; "ac" before a vowel: ac Ynys Môn.
 * Digraphs (ch, ph, th) and other letters are left alone. Use only on Welsh text.
 */
export function andPlace(name: string): string {
  if (/^[aeiouwyâêîôûŵŷ]/i.test(name)) return `ac ${name}`;
  const m = /^(\S)(\S?)/.exec(name);
  if (!m || ["ch", "ph", "th"].includes((m[1] + m[2]).toLowerCase())) return `a ${name}`;
  const to = ({ c: "ch", p: "ph", t: "th" } as Record<string, string>)[m[1].toLowerCase()];
  if (!to) return `a ${name}`;
  return `a ${m[1] === m[1].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to}${name.slice(1)}`;
}

/**
 * "yn" before a place name, with the nasal mutation: yng Nghaerdydd, yng
 * Ngwynedd, ym Mhowys, ym Mro Morgannwg, yn Nhorfaen, ym Merthyr Tudful,
 * yn Sir Gâr. Digraphs and other letters take plain "yn". Use only on Welsh text.
 */
export function ynPlace(name: string): string {
  const m = /^(\S)(\S?)/.exec(name);
  if (!m) return `yn ${name}`;
  const pair = (m[1] + m[2]).toLowerCase();
  const rest = name.slice(1);
  const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
  if (["ch", "dd", "ff", "ng", "ph", "th", "ll", "rh"].includes(pair)) return `yn ${name}`;
  switch (m[1].toLowerCase()) {
    case "c":
      return `yng ${cap("ngh")}${rest}`;
    case "g":
      return `yng ${cap("ng")}${rest}`;
    case "p":
      return `ym ${cap("mh")}${rest}`;
    case "b":
      return `ym ${cap("m")}${rest}`;
    case "t":
      return `yn ${cap("nh")}${rest}`;
    case "d":
      return `yn ${cap("n")}${rest}`;
    case "m":
      return `ym ${name}`;
    default:
      return `yn ${name}`;
  }
}
