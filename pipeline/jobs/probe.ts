/**
 * Saves raw replies from council sites the build environment can't reach,
 * so parsers can be written and tested against the real thing. Each reply is
 * stored in pipeline_state under probe:<n> and can be read back through
 * /api/probe. Cheap: a handful of requests.
 *
 *   pnpm pipeline probe
 */
import { ACTIVE_COUNCILS } from "../../data/curated/councils";
import { DATAMAP_WFS } from "../sources/datamap";
import { fetchBytes, fetchText, relayCheck } from "../lib/http";
import { pdfText } from "../lib/pdf";
import { sql } from "drizzle-orm";
import type { Job } from "../lib/job";

function targets(): string[] {
  const cardiff = ACTIVE_COUNCILS.find((c) => c.id === "cardiff")!.moderngovBase!;
  return [
    // Why reading Cardiff's reports is refused (HTTP 403), and whether other councils differ.
    // Second homes: what the figures for Bridgend and a coastal council look like, and the layer's own description.
    `${DATAMAP_WFS}/geonode/ows?service=WFS&version=2.0.0&request=GetFeature&outputFormat=application/json&typeNames=second_homes_per_1000_ct_chargeable_homes_msoa_march_2023&propertyName=msoa_name,number&CQL_FILTER=${encodeURIComponent("msoa_name LIKE 'Bridgend%' OR msoa_name LIKE 'Gwynedd%'")}`,
    "https://datamap.gov.wales/api/v2/datasets?search=second%20homes",
    "https://datamap.gov.wales/api/v2/resources?search=second_homes_per_1000",
    // Planning registers PlanIt doesn't cover or has stopped reading: can we reach them, and what do they look like?
    "https://www.cardiffidoxcloud.wales/publicaccess/search.do?action=weeklyList&searchType=Application",
    "https://publicaccess.newport.gov.uk/online-applications/search.do?action=weeklyList&searchType=Application",
    "https://planningonline.monmouthshire.gov.uk/online-applications/search.do?action=weeklyList&searchType=Application",
    "https://property.swansea.gov.uk/online-applications/search.do?action=weeklyList&searchType=Application",
    "https://amg.gwynedd.llyw.cymru/planning/index.html?language=en&fa=search",
    "https://planning.denbighshire.gov.uk/planning",
    // By-elections archive: the shape of a year's table.
    "https://opencouncildata.co.uk/changesC.php?y=2025",
    "https://opencouncildata.co.uk/changesC.php?y=2022",
    `${cardiff}/mgConvert2PDF.aspx?ID=99423`,
    `${cardiff}/mgConvert2PDF.aspx?ID=99423&T=10`,
    `${cardiff}/ieListDocuments.aspx?CId=151&MId=8838`,
    `${cardiff}/mgIssueHistoryHome.aspx?IId=1`,
  ];
}

export const probeJob: Job = {
  name: "probe",
  description: "Saves sample replies from council sites for writing parsers",
  async run(ctx) {
    // Which councils refuse report downloads: try two recent documents from each.
    const docs = await ctx.db.execute<{ councilId: string; url: string }>(sql`
      select council_id as "councilId", url from (
        select d.council_id, d.url, row_number() over (partition by d.council_id order by m.date desc) as n
        from documents d join meetings m on m.council_id = d.council_id and m.id = d.meeting_id
        where m.date < now() and m.date > now() - interval '120 days') x
      where n <= 2`);
    const outcome: Record<string, string> = {};
    for (const d of docs) {
      const b = await fetchBytes(d.url);
      const pdf = b.ok && b.bytes[0] === 0x25 && b.bytes[1] === 0x50;
      const relayed = b.ok ? "" : ` (relay: ${await relayCheck(d.url)})`;
      outcome[d.councilId] = `${outcome[d.councilId] ? `${outcome[d.councilId]}; ` : ""}${b.ok ? (pdf ? "pdf" : "not pdf") : b.error.slice(0, 60)}${relayed}`;
    }
    for (const [id, v] of Object.entries(outcome)) ctx.stats[`doc ${id}`] = v;
    for (const d of docs) if (!/^pdf; pdf$/.test(outcome[d.councilId] ?? "")) ctx.stats[`docurl ${d.councilId}`] = d.url;
    // What the Idox registers gave: states, types, decisions and dates, to check the mapping.
    const idox = await ctx.db.execute<{ k: string; n: number }>(sql`
      select k, count(*)::int as n from (
        select 'state ' || coalesce(app_state, 'null') as k from planning_applications where authority = 'monmouthshire'
        union all select 'type ' || coalesce(app_type, 'null') from planning_applications where authority = 'monmouthshire'
        union all select 'decision ' || coalesce(decision, 'null') from planning_applications where authority = 'monmouthshire'
        union all select 'by ' || coalesce(decided_by, 'null') from planning_applications where authority = 'monmouthshire'
        union all select 'decided ' || (decided_date is not null)::text || ' located ' || (lat is not null)::text from planning_applications where authority = 'monmouthshire'
        union all select 'start ' || to_char(start_date, 'YYYY-MM') from planning_applications where authority = 'monmouthshire'
      ) x group by k order by k`);
    ctx.stats.idox = idox.map((r) => `${r.k}: ${r.n}`).join("; ");
    // How far each council's meeting record goes, and how complete it is.
    const cover = await ctx.db.execute<{ c: string; v: string }>(sql`
      select m.council_id as c, json_build_object(
        'meetings', count(*), 'past', count(*) filter (where m.date <= current_date),
        'from', min(m.date)::text, 'lastPast', max(m.date) filter (where m.date <= current_date),
        'yearPast', count(*) filter (where m.date <= current_date and m.date > current_date - 365),
        'minutes', count(*) filter (where m.minutes_published),
        'withAttendance', count(*) filter (where exists (select 1 from attendance a where a.council_id = m.council_id and a.meeting_id = m.id)),
        'withItems', count(*) filter (where exists (select 1 from agenda_items i where i.council_id = m.council_id and i.meeting_id = m.id)),
        'summaries', count(*) filter (where exists (select 1 from summaries s where s.council_id = m.council_id and s.meeting_id = m.id))
      )::text as v
      from meetings m where not m.cancelled group by 1`);
    for (const r of cover) ctx.stats[`cover ${r.c}`] = r.v;
    // What the AI summaries have cost, month by month.
    const spend = await ctx.db.execute<{ k: string; n: number; pence: number }>(sql`
      select to_char(created_at, 'YYYY-MM') || ' ' || model as k, count(*)::int as n, coalesce(sum(cost_pence), 0)::float8 as pence
      from summaries where created_at > now() - interval '120 days' group by 1 order by 1`);
    for (const r of spend) ctx.stats[`spend ${r.k}`] = `${r.n} summaries, £${(r.pence / 100).toFixed(2)}`;
    const list = targets();
    for (const [n, url] of list.entries()) {
      if (/\.pdf$/i.test(url)) {
        // PDFs: save the extracted text, as the pipeline would read it.
        const b = await fetchBytes(url);
        const text = b.ok ? await pdfText(b.bytes).catch((e: Error) => `pdf error: ${e.message}`) : b.error;
        await ctx.setState(`probe:${n}`, { url, ok: b.ok, status: b.ok ? 200 : 0, at: new Date().toISOString(), text: text.slice(0, 400_000) });
        ctx.count(b.ok ? "saved" : "failed");
        continue;
      }
      const r = await fetchText(url, { retries: 1 });
      await ctx.setState(`probe:${n}`, {
        url,
        ok: r.ok,
        status: r.status,
        at: new Date().toISOString(),
        // A refusal's body usually says why: keep it.
        text: r.ok
          ? r.text.slice(0, 400_000)
          : `${r.error}\n${await fetch(url)
              .then((x) => x.text())
              .catch((e: Error) => e.message)
              .then((t) => t.slice(0, 20_000))}`,
      });
      ctx.count(r.ok ? "saved" : "failed");
    }
  },
};
