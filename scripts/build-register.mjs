/**
 * Builds data/curated/register.json, the list of every UK council OpenCouncils
 * knows about, from mySociety's UK local authority register
 * (github.com/mysociety/uk_local_authority_names_and_codes), vendored at
 * data/sources/uk_local_authorities.csv.
 *
 *   node scripts/build-register.mjs
 *
 * Keeps current principal councils (counties, districts, unitaries, London
 * boroughs, the City of London, Scottish, Welsh and Northern Irish councils)
 * and combined authorities (phase two, stored but not shown). Councils that
 * have been abolished stay in the file with their end date and successor, so
 * pages can show lineage. Reorganisation not yet in mySociety's register
 * (Surrey, April 2027) is added from data/curated/reorganisation.json.
 *
 * Re-run after updating the CSV or the reorganisation file; commit the output.
 */
import { readFileSync, writeFileSync } from "node:fs";

const csv = readFileSync(new URL("../data/sources/uk_local_authorities.csv", import.meta.url), "utf8");
const reorg = JSON.parse(readFileSync(new URL("../data/curated/reorganisation.json", import.meta.url), "utf8"));

/** Minimal RFC 4180 parser: the file quotes fields that hold commas. */
function parse(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const slug = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Ids the Welsh site already uses, kept so data copied from it lines up. */
const WELSH_IDS = { "Isle of Anglesey": "anglesey", "Rhondda Cynon Taff": "rhondda-cynon-taf", "The Vale of Glamorgan": "vale-of-glamorgan" };

/** The register's type codes, grouped the way the site talks about them. */
const KIND = {
  CTY: "county", NMD: "district", MD: "metropolitan", LBO: "london-borough", UA: "unitary", CC: "city-corporation",
  SCO: "unitary", WPA: "unitary", NID: "district", COMB: "combined", SRA: "combined",
};

const all = parse(csv);
const rows = all.filter((r) => KIND[r["local-authority-type"]]);
const unknown = [...new Set(all.map((r) => r["local-authority-type"]).filter((t) => t && !KIND[t]))];
if (unknown.length) console.log("Types left out:", unknown.join(", "));

const byCode = new Map(rows.map((r) => [r["local-authority-code"], r]));
const ids = new Map();
for (const r of rows) {
  const nice = r["nice-name"];
  let id = WELSH_IDS[nice] ?? slug(nice);
  // Abolished councils sometimes share a name with today's: keep both apart.
  if ([...ids.values()].includes(id)) id = `${id}-${(r["end-date"] || r["start-date"]).slice(0, 4)}`;
  ids.set(r["local-authority-code"], id);
}

const councils = rows.map((r) => {
  const kind = KIND[r["local-authority-type"]];
  return {
    id: ids.get(r["local-authority-code"]),
    code: r["local-authority-code"],
    name: r["official-name"],
    short: r["nice-name"],
    nation: r.nation,
    region: r.region || null,
    kind,
    typeName: r["local-authority-type-name"],
    gss: r["gss-code"] || null,
    startDate: r["start-date"] || null,
    endDate: r["end-date"] || null,
    replacedBy: (r["replaced-by"] || "").split("|").filter(Boolean).map((c) => ids.get(c) ?? c),
    county: r["county-la"] ? ids.get(r["county-la"]) ?? null : null,
    combinedAuthority: r["combined-authority"] ? ids.get(r["combined-authority"]) ?? null : null,
    population: r["pop-2020"] ? Math.round(Number(r["pop-2020"])) : null,
    lat: r.lat ? Number(Number(r.lat).toFixed(4)) : null,
    lng: r.long ? Number(Number(r.long).toFixed(4)) : null,
    govUkSlug: r["gov-uk-slug"] || null,
    wdtkId: r["wdtk-id"] ? Number(r["wdtk-id"]) : null,
    ocdId: r["open-council-data-id"] || null,
    current: r["current-authority"] === "True",
  };
});

// Reorganisation the register doesn't hold yet.
for (const change of reorg.changes) {
  for (const n of change.new) {
    if (councils.some((c) => c.id === n.id)) continue;
    councils.push({
      id: n.id, code: null, name: n.name, short: n.short, nation: "England", region: n.region ?? null, kind: "unitary",
      typeName: "Unitary authority", gss: n.gss ?? null, startDate: change.vestingDate, endDate: null, replacedBy: [],
      county: null, combinedAuthority: null, population: null, lat: n.lat ?? null, lng: n.lng ?? null, govUkSlug: null, wdtkId: null, ocdId: null,
      current: false, shadow: true, status: change.status, reorganisation: change.id, replaces: n.replaces,
    });
  }
  for (const n of change.new) {
    for (const oldId of n.replaces) {
      const c = councils.find((x) => x.id === oldId);
      if (!c) throw new Error(`Reorganisation names an unknown council: ${oldId}`);
      c.endDate ??= change.dayBefore;
      c.replacedBy = [...new Set([...c.replacedBy, n.id])];
      c.reorganisation = change.id;
    }
  }
}

councils.sort((a, b) => a.short.localeCompare(b.short, "en-GB"));
const principal = councils.filter((c) => c.current && c.kind !== "combined");
const byNation = Object.fromEntries(["England", "Scotland", "Wales", "Northern Ireland"].map((n) => [n, principal.filter((c) => c.nation === n).length]));
writeFileSync(
  new URL("../data/curated/register.json", import.meta.url),
  `${JSON.stringify({ source: "mySociety, UK local authority names and codes", built: new Date().toISOString().slice(0, 10), councils }, null, 1)}\n`,
);
console.log(`${principal.length} current principal councils`, byNation, `${councils.filter((c) => c.kind === "combined" && c.current).length} combined authorities`, `${councils.length} rows in all`);
void byCode;
