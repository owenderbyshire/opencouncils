/**
 * OpenCouncil's open data API. Read-only JSON (or CSV with ?format=csv),
 * free to use under the Open Government Licence. See /data for the guide.
 *
 *   /api/v1                                   what's available
 *   /api/v1/councils                          the 22 councils
 *   /api/v1/councils/{id}/meetings            ?from=&to=&page=
 *   /api/v1/councils/{id}/meetings/{meeting}  agenda, minutes, decisions, papers, attendance, summary
 *   /api/v1/councils/{id}/councillors
 *   /api/v1/councils/{id}/committees
 *   /api/v1/decisions                         ?council=&topic=&from=&page=
 *   /api/v1/planning                          ?authority=&from=&page=
 *   /api/v1/consultations
 *   /api/v1/cabinets                          ?council=&topic=   who holds what: leaders, Cabinet members, committee chairs
 *   /api/v1/planned-decisions                 ?council=&topic=&from=&executive=1&page=   decisions councils plan to take
 *   /api/v1/planned-decisions/coverage        which councils' lists can be read, and when each last was
 */
import type { NextRequest } from "next/server";
import {
  apiCabinets,
  apiCommittees,
  apiConsultations,
  apiCouncillors,
  apiDecisions,
  apiMeeting,
  apiMeetings,
  apiPlannedCoverage,
  apiPlannedDecisions,
  apiPlanning,
  type ApiList,
} from "@/data/open-data";
import { issueBySlug } from "@data/curated/compare-decisions";
import { apiCompare } from "@/data/compare-decisions";
import { PLANNING_AUTHORITIES } from "@data/curated/planning-authorities";
import { liveCouncil, LIVE_COUNCILS } from "@/lib/councils";
import { isId } from "@/lib/route";
import { SITE } from "@/lib/site";
import { TOPIC_BY_SLUG } from "@/lib/topics";

const LICENCE = "Open Government Licence v3.0 (council records); summaries by OpenCouncil, free to reuse with attribution; planning applications (collected by UK PlanIt): All rights reserved, as no licence is stated";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 1), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=900, s-maxage=900",
      "access-control-allow-origin": "*",
    },
  });
}

function csv(list: ApiList, name: string): Response {
  const cols = [...new Set(list.rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const raw = Array.isArray(v) ? v.join("; ") : typeof v === "object" ? JSON.stringify(v) : String(v);
    // Stop spreadsheets treating text such as "=HYPERLINK(...)" as a formula.
    const s = typeof v === "string" && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [cols.join(","), ...list.rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
  return new Response(`﻿${body}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}.csv"`,
      "cache-control": "public, max-age=900, s-maxage=900",
      "access-control-allow-origin": "*",
    },
  });
}

const notFound = (what: string) => json({ error: `Not found: ${what}` }, 404);

export async function GET(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const path = (await params).path ?? [];
  const q = req.nextUrl.searchParams;
  const page = Math.min(10_000, Math.max(1, Number.parseInt(q.get("page") ?? "1", 10) || 1));
  const asCsv = q.get("format") === "csv";
  // Up to 1,000 rows a page when asked; 100 by default.
  const size = Math.min(1000, Math.max(1, Number.parseInt(q.get("size") ?? "100", 10) || 100));
  const list = (data: ApiList, name: string) =>
    asCsv
      ? csv(data, name)
      : json({
          licence: LICENCE,
          source: SITE.url,
          total: data.total,
          page: data.page,
          pageSize: data.pageSize,
          next: data.page * data.pageSize < data.total ? `${req.nextUrl.pathname}?${new URLSearchParams({ ...Object.fromEntries(q), page: String(data.page + 1) })}` : null,
          rows: data.rows,
        });

  const [a, b, c, d] = path;
  if (!a)
    return json({
      name: `${SITE.name} open data API`,
      licence: LICENCE,
      guide: `${SITE.url}/data`,
      endpoints: [
        "/api/v1/councils",
        "/api/v1/councils/{id}/meetings?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1",
        "/api/v1/councils/{id}/meetings/{meetingId}",
        "/api/v1/councils/{id}/councillors",
        "/api/v1/councils/{id}/committees",
        "/api/v1/decisions?council={id}&topic={topic}&from=YYYY-MM-DD&page=1",
        "/api/v1/planning?authority={id}&from=YYYY-MM-DD&page=1",
        "/api/v1/consultations",
        "/api/v1/cabinets?council={id}&topic={topic}",
        "/api/v1/planned-decisions?council={id}&topic={topic}&from=YYYY-MM-DD&executive=1&page=1",
        "/api/v1/planned-decisions/coverage",
        "/api/v1/compare/council-tax-2026-27",
        "/api/v1/compare/visitor-levy",
      ],
      formats: "JSON by default; add ?format=csv to any list. Lists give 100 rows a page; ask for up to 1,000 with ?size=1000.",
    });

  if (a === "councils") {
    if (!b) {
      const data: ApiList = {
        total: LIVE_COUNCILS.length,
        page: 1,
        pageSize: LIVE_COUNCILS.length,
        rows: LIVE_COUNCILS.map((x) => ({ id: x.id, name: x.nameEn, nameCy: x.nameCy, website: x.website, records: x.recordsUrl, page: `${SITE.url}/${x.id}` })),
      };
      return list(data, "councils");
    }
    const council = liveCouncil(b);
    if (!council) return notFound(`council ${b}`);
    if (c === "meetings" && !d) return list(await apiMeetings(council.id, q.get("from"), q.get("to"), page, size), `${council.id}-meetings`);
    if (c === "meetings" && d) {
      if (!isId(d)) return notFound(`meeting ${d}`);
      const m = await apiMeeting(council.id, Number(d));
      return m ? json({ licence: LICENCE, page: `${SITE.url}/${council.id}/meetings/${d}`, meeting: m }) : notFound(`meeting ${d}`);
    }
    if (c === "councillors") return list(await apiCouncillors(council.id), `${council.id}-councillors`);
    if (c === "committees") return list(await apiCommittees(council.id), `${council.id}-committees`);
    return notFound(path.join("/"));
  }
  if (a === "compare") {
    const issue = b ? issueBySlug(b) : undefined;
    if (!issue || c) return notFound(path.join("/"));
    const all = await apiCompare(issue);
    return list({ total: all.length, page: 1, pageSize: all.length, rows: all }, `opencouncil-${issue.slug}`);
  }
  if (a === "decisions") {
    const council = q.get("council");
    const topic = q.get("topic");
    if (council && !liveCouncil(council)) return notFound(`council ${council}`);
    if (topic && !TOPIC_BY_SLUG.has(topic)) return notFound(`topic ${topic}`);
    return list(await apiDecisions(council, topic, q.get("from"), page, size), "decisions");
  }
  if (a === "planning") {
    const authority = q.get("authority");
    if (authority && !PLANNING_AUTHORITIES.some((x) => x.id === authority)) return notFound(`planning authority ${authority}`);
    return list(await apiPlanning(authority, q.get("from"), page, size), "planning-applications");
  }
  if (a === "consultations") return list(await apiConsultations(), "consultations");
  if (a === "planned-decisions") {
    if (b === "coverage") return list(await apiPlannedCoverage(), "planned-decisions-coverage");
    if (b) return notFound(path.join("/"));
    const council = q.get("council");
    const topic = q.get("topic");
    if (council && !liveCouncil(council)) return notFound(`council ${council}`);
    if (topic && !TOPIC_BY_SLUG.has(topic)) return notFound(`topic ${topic}`);
    return list(await apiPlannedDecisions(council, topic, q.get("from"), q.get("executive") === "1", page, size), "planned-decisions");
  }
  if (a === "cabinets") {
    const council = q.get("council");
    const topic = q.get("topic");
    if (council && !liveCouncil(council)) return notFound(`council ${council}`);
    if (topic && !TOPIC_BY_SLUG.has(topic)) return notFound(`topic ${topic}`);
    return list(await apiCabinets(council, topic), "who-holds-what");
  }
  return notFound(path.join("/"));
}
