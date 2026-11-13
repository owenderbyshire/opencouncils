import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

// The messages modules import defineMessages from src/i18n/server, which reads the
// root route parameter; outside Next that module is a placeholder.
vi.mock("next/root-params", () => ({ lang: async () => "en" }));

/*
 * House style, checked on the text the site shows and the text it sends to
 * the model: every messages module, the pages and components, the pipeline's
 * prompts and the docs. Curated data is left out because it quotes councils
 * and publishers word for word.
 */

const ROOT = path.resolve(import.meta.dirname, "..");

function filesUnder(dir: string, ext: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, entry);
    if (statSync(path.join(ROOT, rel)).isDirectory()) out.push(...filesUnder(rel, ext));
    else if (ext.some((e) => entry.endsWith(e)) && !entry.endsWith(".test.ts")) out.push(rel);
  }
  return out;
}

const COPY = [
  ...filesUnder("src", [".ts", ".tsx"]),
  ...filesUnder("pipeline/jobs", [".ts"]),
  ...filesUnder("pipeline/lib", [".ts"]),
  ...filesUnder("docs", [".md"]),
  "README.md",
  "AGENTS.md",
];

const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

/** Lines of a file that match, as "file:line: text", for a readable failure. */
function offending(files: string[], re: RegExp): string[] {
  const hits: string[] = [];
  for (const file of files) {
    read(file)
      .split("\n")
      .forEach((line, i) => {
        if (re.test(line)) hits.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
  }
  return hits;
}

/** Every string in a messages object, flattened. */
function strings(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.flatMap(strings);
  if (v && typeof v === "object") return Object.values(v).flatMap(strings);
  return [];
}

/** Every key path in a messages object, so Welsh and English can be compared. */
function keys(o: unknown, p = ""): string[] {
  if (!o || typeof o !== "object") return [];
  if (Array.isArray(o)) return o.flatMap((v, i) => keys(v, `${p}${i}.`));
  return Object.entries(o).flatMap(([k, v]) => [`${p}${k}`, ...keys(v, `${p}${k}.`)]);
}

interface Messages {
  en: unknown;
  cy: unknown;
}

/** Every messages module under src/i18n/messages, so a new one is covered without being listed here. */
async function allMessages(): Promise<Array<{ file: string; name: string; messages: Messages }>> {
  const out: Array<{ file: string; name: string; messages: Messages }> = [];
  for (const file of filesUnder("src/i18n/messages", [".ts"])) {
    const mod: Record<string, unknown> = await import(path.join(ROOT, file));
    for (const [name, value] of Object.entries(mod)) {
      if (value && typeof value === "object" && "en" in value && "cy" in value) out.push({ file, name, messages: value as Messages });
    }
  }
  return out;
}

describe("messages", () => {
  it("has a module for every area, with the same keys in Welsh and English", async () => {
    const all = await allMessages();
    expect(all.length).toBeGreaterThan(10);
    for (const { file, name, messages } of all) expect(keys(messages.cy).sort(), `${file} ${name}`).toEqual(keys(messages.en).sort());
  });

  it("follows the writing rules", async () => {
    for (const { file, messages } of await allMessages()) {
      for (const s of [...strings(messages.en), ...strings(messages.cy)]) {
        expect(s, file).not.toMatch(/—/);
        expect(s, file).not.toMatch(/\bit is worth noting\b/i);
        expect(s, file).not.toMatch(/\bnot (?:just |only )?\w+,? but\b/i);
      }
    }
  });

  it("writes the Welsh, UK and Scottish Governments with a capital G", async () => {
    // The institution takes a capital: "Welsh Government", "Llywodraeth Cymru". Government
    // in general ("local government", "cymorth y llywodraeth") stays lower case.
    for (const { file, messages } of await allMessages()) {
      for (const s of [...strings(messages.en), ...strings(messages.cy)]) {
        expect(s, file).not.toMatch(/\b(?:Welsh|UK|Scottish|welsh|uk|scottish) government\b/);
        expect(s, file).not.toMatch(/\b(?:welsh|uk|scottish) Government\b/);
        // "Lywodraeth" is the soft mutation after gan, i, o, wrth: it keeps its capital.
        expect(s, file).not.toMatch(/\b(?:ll|l)ywodraeth (?:Cymru|y DU|yr Alban)\b/);
        expect(s, file).not.toMatch(/\b(?:Ll|L)ywodraeth (?:cymru|y du|yr alban)\b/);
      }
    }
  });

  it("never translates the product names", async () => {
    for (const { file, messages } of await allMessages()) {
      for (const s of strings(messages.cy)) expect(s, file).not.toMatch(/Cyngor Agored|Senedd Agored|Elusen Agored|Economi Agored/);
    }
  });
});

describe("house style in pages, prompts and docs", () => {
  it("writes the institutions with a capital G", () => {
    expect(offending(COPY, /\b(?:Welsh|UK|Scottish|welsh|uk|scottish) government\b/)).toEqual([]);
    expect(offending(COPY, /\b(?:welsh|uk|scottish) Government\b/)).toEqual([]);
    expect(offending(COPY, /\b(?:ll|l)ywodraeth (?:Cymru|y DU|yr Alban)\b/)).toEqual([]);
    expect(offending(COPY, /\b(?:Ll|L)ywodraeth (?:cymru|y du|yr alban)\b/)).toEqual([]);
  });

  it("uses no em dashes in interface strings", () => {
    expect(offending(filesUnder("src/i18n/messages", [".ts"]), /—/)).toEqual([]);
  });

  it("never links to the family's old hosts", () => {
    // src/proxy.ts redirects the old host itself, and docs/family-design.md states this rule.
    const everything = [...COPY, ...filesUnder("data/curated", [".ts", ".json"]), ...filesUnder("scripts", [".mjs", ".ts"]), ...filesUnder("pipeline/sources", [".ts"])].filter(
      (f) => f !== "src/proxy.ts" && f !== "docs/family-design.md",
    );
    expect(offending(everything, /localrecord\.wales|getcambria\.app/)).toEqual([]);
  });
});
