/**
 * A small reader for OpenDocument spreadsheets (.ods), which the Welsh
 * Government publishes some statistics as. An .ods file is a zip holding
 * content.xml; each sheet is a table of rows of cells.
 */
import { strFromU8, unzipSync } from "fflate";
import { parse } from "node-html-parser";

export interface Sheet {
  name: string;
  rows: string[][];
}

const MAX_REPEAT = 200;

export function parseOds(bytes: Uint8Array): Sheet[] {
  const files = unzipSync(bytes, { filter: (f) => f.name === "content.xml" });
  const xml = files["content.xml"];
  if (!xml) throw new Error("no content.xml in the file");
  const root = parse(strFromU8(xml), { lowerCaseTagName: false });
  const sheets: Sheet[] = [];
  for (const table of root.querySelectorAll("table\\:table")) {
    const rows: string[][] = [];
    for (const tr of table.querySelectorAll("table\\:table-row")) {
      const cells: string[] = [];
      for (const td of tr.childNodes) {
        if (!("rawTagName" in td)) continue;
        const el = td as unknown as { rawTagName: string; getAttribute(n: string): string | undefined; querySelectorAll(s: string): Array<{ text: string }> };
        if (el.rawTagName !== "table:table-cell" && el.rawTagName !== "table:covered-table-cell") continue;
        const value = el.getAttribute("office:value") ?? el.querySelectorAll("text\\:p").map((p) => p.text).join(" ").trim();
        const repeat = Math.min(MAX_REPEAT, Number(el.getAttribute("table:number-columns-repeated") ?? 1));
        for (let i = 0; i < repeat; i++) cells.push(value);
      }
      while (cells.length && !cells[cells.length - 1]) cells.pop();
      const repeatRows = Math.min(5, Number(tr.getAttribute("table:number-rows-repeated") ?? 1));
      for (let i = 0; i < repeatRows; i++) rows.push(cells);
    }
    while (rows.length && !rows[rows.length - 1].length) rows.pop();
    sheets.push({ name: table.getAttribute("table:name") ?? "", rows });
  }
  return sheets;
}
