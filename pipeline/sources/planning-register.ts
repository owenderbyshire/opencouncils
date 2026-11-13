/**
 * Parsers for the "planning-register" public access system used by Bridgend
 * (planning.bridgend.gov.uk) and the Vale of Glamorgan
 * (vogonline.planning-register.co.uk). Both put a disclaimer in front of the
 * register, search by date received, list results ten to a page with links to
 * /Planning/Display/<reference>, and show each application's details as
 * label and value pairs (table rows on the Vale's, a definition list on
 * Bridgend's).
 */
import { parse, type HTMLElement } from "node-html-parser";

const clean = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** "18/09/2026" to "2026-09-18"; anything else to null. */
export function registerDate(s: string | null | undefined): string | null {
  const m = clean(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** A form's hidden fields, as the browser would send them. */
export function hiddenFields(html: string): URLSearchParams {
  const out = new URLSearchParams();
  for (const input of parse(html).querySelectorAll('input[type="hidden"]')) {
    const name = input.getAttribute("name");
    // node-html-parser decodes entities in attribute values.
    if (name && !out.has(name)) out.set(name, input.getAttribute("value") ?? "");
  }
  return out;
}

/** References on a results page, in order, each once. */
export function resultReferences(html: string): string[] {
  const out: string[] = [];
  for (const a of parse(html).querySelectorAll('a[href*="/Planning/Display/"]')) {
    const ref = decodeURIComponent((a.getAttribute("href") ?? "").split("/Planning/Display/")[1] ?? "").trim();
    if (ref && !out.includes(ref)) out.push(ref);
  }
  return out;
}

/** The highest page number a results page links to. */
export function lastResultsPage(html: string): number {
  let max = 1;
  for (const m of html.matchAll(/\/Search\/ResultsPage\/(\d+)/g)) max = Math.max(max, Number(m[1]));
  return max;
}

const text = (el: HTMLElement | null | undefined) => clean(el?.text);

/**
 * Every label and value on an application's page, labels lower-cased: table
 * rows with two cells, definition lists, and the Vale's progress bar (a
 * heading row over a value row).
 */
export function registerFields(html: string): Record<string, string> {
  const root = parse(html);
  const out: Record<string, string> = {};
  const put = (k: string, v: string) => {
    const key = k.toLowerCase().replace(/:$/, "").trim();
    if (key && !(key in out)) out[key] = v;
  };
  for (const t of root.querySelectorAll("table.progressBarTbl")) {
    const [head, value] = t.querySelectorAll("tr");
    if (head && value) put(text(head), text(value));
  }
  for (const tr of root.querySelectorAll("tr")) {
    const cells = tr.querySelectorAll("td, th");
    if (cells.length === 2) put(text(cells[0]), text(cells[1]));
  }
  for (const dl of root.querySelectorAll("dl")) {
    const kids = dl.childNodes.filter((n): n is HTMLElement => n instanceof Object && "tagName" in n && !!(n as HTMLElement).tagName);
    for (let i = 0; i < kids.length - 1; i++) {
      if (kids[i].tagName === "DT" && kids[i + 1].tagName === "DD") put(text(kids[i]), text(kids[i + 1]));
    }
  }
  return out;
}

/** A value, unless it's one of the registers' ways of saying there isn't one. */
export function present(v: string | undefined): string | null {
  const s = clean(v);
  return !s || /^(-|n\/a|null|pending|not available)$/i.test(s) ? null : s;
}

export interface RegisterApplication {
  reference: string;
  address: string | null;
  proposal: string | null;
  status: string | null;
  decision: string | null;
  appType: string | null;
  received: string | null;
  valid: string | null;
  target: string | null;
  decided: string | null;
  lastComment: string | null;
  level: string | null;
  ward: string | null;
}

/** The fields we keep from an application's page. */
export function registerApplication(reference: string, html: string): RegisterApplication {
  const f = registerFields(html);
  const first = (...keys: string[]) => {
    for (const k of keys) {
      const v = present(f[k]);
      if (v) return v;
    }
    return null;
  };
  return {
    reference: first("application number") ?? reference,
    address: first("location", "application location"),
    proposal: first("proposal"),
    status: first("status"),
    decision: first("decision"),
    appType: first("application type"),
    received: registerDate(first("date received", "received")),
    valid: registerDate(first("date valid", "validated", "applicationvalid", "application valid")),
    target: registerDate(first("target decision date", "expires")),
    decided: registerDate(first("decision date", "decisiondate")),
    lastComment: registerDate(first("last comment date")),
    level: first("decision level"),
    ward: first("ward"),
  };
}
