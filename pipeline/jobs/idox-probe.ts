/**
 * Saves sample pages from an Idox Public Access planning register
 * (Monmouthshire's, which answers the pipeline): the weekly list form, one
 * week's results, and one application's summary and dates pages. For writing
 * a parser. Read back through /api/probe?key=idox-...
 *
 *   pnpm pipeline idox-probe [--base https://planningonline.monmouthshire.gov.uk/online-applications]
 */
import { parse } from "node-html-parser";
import { fetchText } from "../lib/http";
import { argString } from "../lib/util";
import type { Job } from "../lib/job";

export const idoxProbeJob: Job = {
  name: "idox-probe",
  description: "Saves sample pages from an Idox planning register",
  async run(ctx) {
    const base = argString(ctx.args, "base") ?? "https://planningonline.monmouthshire.gov.uk/online-applications";
    const save = async (key: string, url: string, text: string, status: number | null) => {
      await ctx.setState(`probe:${key}`, { url, ok: status === 200, status, at: new Date().toISOString(), text: text.slice(0, 400_000) });
      ctx.stats[key] = `${status} ${text.length} chars`;
    };
    const formUrl = `${base}/search.do?action=weeklyList&searchType=Application`;
    const form = await fetchText(formUrl, { fresh: true });
    if (!form.ok) throw new Error(`form: ${form.error}`);
    const root = parse(form.text);
    const csrf = root.querySelector("input[name=_csrf]")?.getAttribute("value") ?? "";
    const week = root.querySelector("select#week option:nth-child(2)")?.getAttribute("value") ?? "";
    ctx.stats.week = week;
    const body = new URLSearchParams({
      _csrf: csrf,
      "searchCriteria.parish": "",
      "searchCriteria.ward": "",
      week,
      dateType: "DC_Validated",
      searchType: "Application",
    }).toString();
    const resultsUrl = `${base}/weeklyListResults.do?action=firstPage`;
    const res = await fetchText(resultsUrl, { fresh: true, method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });
    await save("idox-results", resultsUrl, res.ok ? res.text : res.error, res.ok ? res.status : res.status);
    if (!res.ok) return;
    const link = parse(res.text).querySelector("li.searchresult a")?.getAttribute("href");
    ctx.stats.firstLink = link ?? "none";
    if (!link) return;
    const summaryUrl = new URL(link.replace(/&amp;/g, "&"), `${base}/`).toString();
    const sum = await fetchText(summaryUrl, { fresh: true });
    await save("idox-summary", summaryUrl, sum.ok ? sum.text : sum.error, sum.ok ? sum.status : sum.status);
    const datesUrl = summaryUrl.replace("activeTab=summary", "activeTab=dates");
    const dates = await fetchText(datesUrl, { fresh: true });
    await save("idox-dates", datesUrl, dates.ok ? dates.text : dates.error, dates.ok ? dates.status : dates.status);
    const detailsUrl = summaryUrl.replace("activeTab=summary", "activeTab=details");
    const details = await fetchText(detailsUrl, { fresh: true });
    await save("idox-details", detailsUrl, details.ok ? details.text : details.error, details.ok ? details.status : details.status);
  },
};
