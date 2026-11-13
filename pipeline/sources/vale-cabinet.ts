/**
 * The Vale of Glamorgan's Cabinet page: one table of portfolios and who holds
 * each. The Vale doesn't use ModernGov, so this stands in for the executive
 * posts pages other councils have. Fixture: pipeline/fixtures/vale/cabinet.html.
 */
import { parse } from "node-html-parser";
import { decodeEntities } from "../lib/text";
import { sha1 } from "../lib/util";
import { VALE_BASE } from "./vale";

export const VALE_CABINET_URL = `${VALE_BASE}/en/our_council/Council-Structure/Cabinet/Cabinet.aspx`;

const clean = (s: string | undefined | null) => decodeEntities(s ?? "").replace(/[\s ]+/g, " ").trim();

export interface ValePortfolio {
  /** A number that stands for the portfolio's name: the page gives none. */
  postId: number;
  /** The portfolio as the page words it. */
  title: string;
  holderName: string;
  /** The holder's own page on the council's site, which is how councillors are told apart. */
  holderUrl: string;
}

/**
 * The rows of the "Portfolio / Portfolio Holder" table. Null when the page has
 * no such table, or a row can't be read: the page has then changed, and
 * nothing should be taken from it.
 */
export function parseValeCabinet(html: string): ValePortfolio[] | null {
  const table = parse(html)
    .querySelectorAll("table")
    .find((t) => {
      const heads = t.querySelectorAll("th").map((th) => clean(th.text).toLowerCase());
      return heads.includes("portfolio") && heads.includes("portfolio holder");
    });
  if (!table) return null;
  const out: ValePortfolio[] = [];
  for (const row of table.querySelectorAll("tbody tr")) {
    const cells = row.querySelectorAll("td");
    if (cells.length < 2) return null;
    const title = clean(cells[0].text);
    // The holder's cell also carries empty links left over from earlier holders: only a link with a name in it counts.
    const holders = cells[1]
      .querySelectorAll("a")
      .map((a) => ({ name: clean(a.text), href: a.getAttribute("href") ?? "" }))
      .filter((a) => a.name && /\/councillors\/[^/]+\.aspx$/i.test(a.href));
    if (!title || !holders.length) return null;
    for (const h of holders)
      out.push({
        postId: (Number.parseInt(sha1(title.toLowerCase()).slice(0, 8), 16) & 0x7fffffff) || 1,
        title,
        holderName: h.name.replace(/^(Councillor|Cllr\.?)\s+/i, ""),
        holderUrl: new URL(h.href, VALE_BASE).toString(),
      });
  }
  return out.length ? out : null;
}
