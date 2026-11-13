/**
 * For working out new planning sources: prints the layout of a spreadsheet
 * (--ods <url>), and whether each authority's planning register answers
 * (--registers). Changes nothing.
 */
import { PLANNING_AUTHORITIES } from "../../data/curated/planning-authorities";
import { fetchBytes, fetchText } from "../lib/http";
import { sql } from "drizzle-orm";
import type { Job } from "../lib/job";
import { argString } from "../lib/util";
import { idoxCsrf, idoxWeeks } from "../sources/idox";
import { parseOds } from "../sources/ods";

export const planningProbeJob: Job = {
  name: "planning-probe",
  description: "Prints a spreadsheet's layout and whether each planning register answers",
  async run(ctx) {
    const ods = argString(ctx.args, "ods");
    if (ods) {
      const got = await fetchBytes(ods);
      if (!got.ok) ctx.log(`ODS ${got.error}`);
      else
        for (const s of parseOds(got.bytes)) {
          ctx.log(`SHEET ${s.name}: ${s.rows.length} rows`);
          for (const r of s.rows.slice(0, Number(argString(ctx.args, "rows") ?? 30))) ctx.log(`  ${r.slice(0, 14).join(" | ")}`);
        }
    }
    if (ctx.args.completeness === true) {
      // Every quarter with both counts, for authorities held in full for that quarter.
      const rows = await ctx.db.execute<{ a: string; s: string; n: number; ours: number; d: string }>(sql`
        with official as (
          select c->>'authority' as a, (c->>'start')::date as s, (c->>'end')::date as e, (c->>'received')::int as n
          from pipeline_state, jsonb_array_elements(value->'counts') c where key = 'planning-official'),
        cov as (select k as a, v::date as d from pipeline_state, jsonb_each_text(value) as x(k, v) where key = 'planning-coverage')
        select o.a, o.s::text as s, o.n, cov.d::text as d,
          (select count(*) from planning_applications p where p.authority = o.a and p.start_date between o.s and o.e)::int as ours
        from official o join cov on cov.a = o.a where cov.d <= o.s order by o.a, o.s`);
      for (const r of rows) ctx.log(`COMP ${r.a} ${r.s} ours ${r.ours} official ${r.n} (${Math.round((100 * r.ours) / Math.max(1, r.n))}%)`);
    }
    const names = argString(ctx.args, "names");
    if (names) {
      for (const a of names.split(",")) {
        const rows = await ctx.db.execute<{ name: string; reference: string | null; url: string | null }>(
          sql`select name, reference, url from planning_applications where authority = ${a} order by start_date desc nulls last limit 3`,
        );
        for (const r of rows) ctx.log(`NAME ${a} ${r.name} | ${r.reference} | ${r.url}`);
      }
    }
    const idox = argString(ctx.args, "idox");
    if (idox) {
      // Prints the first results page of an Idox weekly list, to check the parser against it.
      const base = idox;
      const form = await fetchText(`${base}/search.do?action=weeklyList&searchType=Application`, { fresh: true });
      if (!form.ok) ctx.log(`IDOX form ${form.error}`);
      else {
        const csrf = idoxCsrf(form.text) ?? "";
        const week = idoxWeeks(form.text)[Number(argString(ctx.args, "week") ?? 0)] ?? "";
        const r = await fetchText(`${base}/weeklyListResults.do?action=firstPage`, {
          fresh: true,
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ _csrf: csrf, "searchCriteria.parish": "", "searchCriteria.ward": "", week, dateType: "DC_Validated", searchType: "Application" }).toString(),
        });
        if (!r.ok) ctx.log(`IDOX results ${r.error}`);
        else {
          const i = r.text.indexOf("searchresult");
          ctx.log(`IDOX week ${week} length ${r.text.length} showing ${r.text.match(/class="showing"[^<]*<[^>]*>?[^<]*/)?.[0] ?? "none"}`);
          for (const line of r.text.slice(Math.max(0, i - 200), i + 2500).split("\n")) if (line.trim()) ctx.log(`IDOXHTML ${line.trim().slice(0, 250)}`);
        }
      }
    }
    const pages = argString(ctx.args, "page");
    if (pages) {
      // Prints a page's forms, inputs and links, to work out how a register lists applications.
      for (const spec of pages.split(",")) {
        // "POST:<url>" posts an empty form first (to accept a disclaimer, say); cookies carry over.
        if (spec.startsWith("FORM:")) {
          // "FORM:<page>|<action>|k=v&k=v": fills in a form, keeping its hidden fields, and prints the reply.
          const [pageUrl, action, fields] = spec.slice(5).split("|");
          const form = await fetchText(pageUrl, { fresh: true });
          if (!form.ok) {
            ctx.log(`FORMPAGE ${pageUrl} ${form.error}`);
            continue;
          }
          const body = new URLSearchParams();
          for (const m of form.text.matchAll(/<input[^>]*type="hidden"[^>]*>/gi)) {
            const name = m[0].match(/name="([^"]+)"/)?.[1];
            const value = m[0].match(/value="([^"]*)"/)?.[1] ?? "";
            if (name && !body.has(name)) body.set(name, value.replace(/&amp;/g, "&").replace(/&#x2B;/gi, "+").replace(/&#x2F;/gi, "/").replace(/&#x3D;/gi, "="));
          }
          // Dropdowns send their selected option, or the first.
          for (const m of form.text.matchAll(/<select[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/gi)) {
            const sel = m[2].match(/<option[^>]*selected[^>]*value="([^"]*)"/i)?.[1] ?? m[2].match(/<option[^>]*value="([^"]*)"/i)?.[1] ?? "";
            if (!body.has(m[1])) body.set(m[1], sel);
          }
          for (const [k, v] of new URLSearchParams(fields ?? "")) body.set(k, v);
          const r = await fetchText(new URL(action, pageUrl).toString(), { fresh: true, method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: body.toString() });
          if (!r.ok) {
            ctx.log(`FORMPOST ${action} ${r.error}`);
            continue;
          }
          ctx.log(`FORMPOST ${action} ${r.text.length} chars, title ${(r.text.match(/<title>([^<]*)/i)?.[1] ?? "").trim()}`);
          for (const m of r.text.matchAll(/href="([^"#]+)"/gi)) if (!/\.(css|js|png|ico|svg)(\?|$)/i.test(m[1])) ctx.log(`  LINK ${m[1].slice(0, 200)}`);
          if (ctx.args.raw === true) for (const line of r.text.split("\n")) ctx.log(`RAW ${line}`);
          const i = Math.max(0, r.text.search(/<table|class="[^"]*result/i));
          for (const line of r.text.slice(i, i + 6000).split("\n")) if (line.trim()) ctx.log(`  HTML ${line.trim().slice(0, 220)}`);
          continue;
        }
        if (spec.startsWith("RAWPOST:")) {
          // "RAWPOST:<url>|<url-encoded body>": posts the body as it is and prints the reply.
          const [u, b] = spec.slice(8).split("|");
          const r = await fetchText(u, { fresh: true, method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: decodeURIComponent(b ?? "") });
          if (!r.ok) ctx.log(`RAWPOST ${u} ${r.error}`);
          else for (const chunk of r.text.match(/[\s\S]{1,1500}/g) ?? []) ctx.log(`RAWPOST ${chunk}`);
          continue;
        }
        const post = spec.startsWith("POST:");
        const u = post ? spec.slice(5) : spec;
        const r = await fetchText(u, post ? { fresh: true, method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "" } : { fresh: true });
        if (post) {
          ctx.log(`POSTED ${u} ${r.ok ? "ok" : r.error}`);
          continue;
        }
        if (!r.ok) {
          ctx.log(`PAGE ${u} ${r.error}`);
          continue;
        }
        ctx.log(`PAGE ${u} ${r.text.length} chars, title ${(r.text.match(/<title>([^<]*)/i)?.[1] ?? "").trim()}`);
        for (const m of r.text.matchAll(/<form[^>]*>/gi)) ctx.log(`  FORM ${m[0].slice(0, 200)}`);
        for (const m of r.text.matchAll(/<(?:input|select)[^>]*name="([^"]+)"[^>]*>/gi)) ctx.log(`  INPUT ${m[1]} ${m[0].slice(0, 160)}`);
        for (const m of r.text.matchAll(/href="([^"#]+)"/gi)) if (!/\.(css|js|png|ico|svg)(\?|$)/i.test(m[1])) ctx.log(`  LINK ${m[1].slice(0, 200)}`);
        for (const m of r.text.matchAll(/<(th|dt|label|span class="[^"]*label[^"]*")[^>]*>([\s\S]{1,80}?)<\/\1>\s*<(td|dd|div|span)[^>]*>([\s\S]{0,300}?)<\/\3>/gi))
          ctx.log(`  FIELD ${m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()} = ${m[4].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 150)}`);
        if (ctx.args.raw === true) for (const line of r.text.split("\n")) ctx.log(`RAW ${line}`);
        const match = argString(ctx.args, "match");
        if (match) {
          const seen = new Set<string>();
          for (const m of r.text.matchAll(new RegExp(match, "gi"))) if (seen.size < 300 && !seen.has(m[0])) seen.add(m[0]);
          for (const m of seen) ctx.log(`MATCH ${m.slice(0, 300)}`);
        }
        const around = argString(ctx.args, "around");
        if (around) {
          const at = r.text.search(new RegExp(around, "i"));
          if (at >= 0) for (const line of r.text.slice(at, at + 5000).split("\n")) if (line.trim()) ctx.log(`  NEAR ${line.trim().slice(0, 220)}`);
        }
        const opts = argString(ctx.args, "options");
        if (opts) {
          const sel = r.text.match(new RegExp(`<select[^>]*name="${opts}"[\\s\\S]*?</select>`, "i"))?.[0] ?? "";
          for (const m of sel.matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/gi)) ctx.log(`  OPTION ${m[1]} = ${m[2].trim()}`);
        }
        if (ctx.args.body === true) for (const line of r.text.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").match(/.{1,200}/g) ?? []) ctx.log(`  TEXT ${line}`);
        for (const m of r.text.matchAll(/(?:fetch|ajax|url)\s*[:(]\s*["']([^"']+)["']/gi)) ctx.log(`  API ${m[1].slice(0, 200)}`);
      }
    }
    if (ctx.args.registers === true) {
      for (const a of PLANNING_AUTHORITIES) {
        const r = await fetchText(a.portal, { fresh: true });
        const kind = !r.ok
          ? r.error.slice(0, 80)
          : /online-applications|Idox|idox/i.test(r.text)
            ? "idox"
            : /agileapplications|Agile/i.test(r.text)
              ? "agile"
              : /tascomi/i.test(r.text)
                ? "tascomi"
                : /salesforce|force\.com|lightning/i.test(r.text)
                  ? "salesforce"
                  : /Northgate|PlanningExplorer/i.test(r.text)
                    ? "northgate"
                    : `other (${r.text.length} chars, title ${(r.text.match(/<title>([^<]*)/i)?.[1] ?? "").trim().slice(0, 60)})`;
        ctx.log(`REG ${a.id} ${a.portal} => ${kind}`);
      }
    }
  },
};
