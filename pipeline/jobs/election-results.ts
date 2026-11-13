/**
 * The May 2022 council election results, ward by ward, from each council's
 * ModernGov web service (pipeline/sources/election-results.ts). Saved in
 * pipeline_state under "elections-2022"; the elections pages read it.
 *
 * The service lists no elections, so for each council the job tries the
 * election id found when this was built (data/curated/election-results.ts)
 * and, failing that, ids from 1 upwards, and keeps the May 2022 council
 * election by rule. A council's wards are shown only when its results pass
 * checkResults; the rest are saved with the reasons, for the notes.
 *
 * 2022 results don't change, so this isn't part of the daily run: run it by
 * hand when a council's service changes or a council is added.
 *
 *   pnpm pipeline election-results [--council cardiff] [--max 150]
 */
import { ELECTION_2022_IDS } from "../../data/curated/election-results";
import { COUNCIL_ELECTIONS } from "../../data/curated/elections";
import { webServiceUrl } from "../../src/lib/official-urls";
import { councilsFor } from "../lib/councils";
import { fetchText } from "../lib/http";
import { PartialFailure, type Job } from "../lib/job";
import { argNumber, mapLimit } from "../lib/util";
import { checkResults, isMay2022CouncilElection, parseElectionResults, pickElection, wardsOf, type ElectionReply, type WardResult } from "../sources/election-results";

export interface CouncilResults2022 {
  councilId: string;
  electionId: number;
  title: string;
  /** The council's own results page, where it answered when the job ran; otherwise null. */
  page: string | null;
  wards: WardResult[];
  /** Why the council's ward detail is not shown; empty when it passes every check. */
  problems: string[];
}

export interface Elections2022State {
  updatedAt: string;
  councils: CouncilResults2022[];
  /** Councils whose service gave no May 2022 council election. */
  notFound: string[];
}

export const electionResultsJob: Job = {
  name: "election-results",
  watches: [
    {
      tags: ["reference"],
      sources: [{ table: "pipeline_state", where: "key = 'elections-2022'", expr: "(value - 'updatedAt')::text" }],
    },
  ],
  description: "May 2022 council election results by ward, from each council's ModernGov service",
  async run(ctx) {
    const max = argNumber(ctx.args, "max") ?? 150;
    const councils = councilsFor(ctx);
    const previous = await ctx.getState<Elections2022State>("elections-2022");
    const found: CouncilResults2022[] = [];
    const notFound: string[] = [];
    const get = async (base: string, id: number): Promise<ElectionReply | null> => {
      const r = await fetchText(webServiceUrl(base, "GetElectionResults", { lElectionId: id }), { retries: 1, fresh: true, accept: "text/xml" });
      return r.ok ? parseElectionResults(r.text) : null;
    };
    await mapLimit(councils, 3, async (c) => {
      const base = c.moderngovBase;
      const seats = COUNCIL_ELECTIONS.find((e) => e.id === c.id)?.election2022.total;
      let chosen: { id: number; reply: ElectionReply } | null = null;
      const known = ELECTION_2022_IDS[c.id];
      if (known === null) {
        notFound.push(c.id);
        return;
      }
      if (known) {
        const reply = await get(base, known);
        if (reply && isMay2022CouncilElection(reply)) chosen = { id: known, reply };
        else ctx.log(`${c.id}: election ${known} no longer looks like May 2022; trying others`);
      }
      if (!chosen) {
        const tried: Array<{ id: number; reply: ElectionReply }> = [];
        let lastHit = 0;
        for (let id = 1; id <= max && id - lastHit <= 60; id++) {
          const reply = await get(base, id);
          if (!reply || !reply.candidates.length) continue;
          lastHit = id;
          tried.push({ id, reply });
        }
        chosen = pickElection(tried);
        ctx.log(`${c.id}: ${tried.length} elections answered; ${chosen ? `chose ${chosen.id} (${chosen.reply.title})` : "none is the May 2022 council election"}`);
      }
      if (!chosen) {
        notFound.push(c.id);
        return;
      }
      const wards = wardsOf(chosen.reply.candidates);
      const problems = seats ? checkResults(wards, seats) : ["no 2022 seat total to check against"];
      const pageUrl = `${base}/mgElectionResults.aspx?ID=${chosen.id}`;
      const page = (await fetchText(pageUrl, { retries: 0, fresh: true })).ok ? pageUrl : null;
      found.push({ councilId: c.id, electionId: chosen.id, title: chosen.reply.title, page, wards, problems });
      ctx.stats[`council ${c.id}`] = `${chosen.id} ${wards.length} wards${problems.length ? `; ${problems.length} problems: ${problems.slice(0, 3).join("; ")}` : "; ok"}`;
    });
    // A run for one council keeps the others as they were.
    const kept = (previous?.councils ?? []).filter((p) => !councils.some((c) => c.id === p.councilId));
    const keptMissing = (previous?.notFound ?? []).filter((id) => !councils.some((c) => c.id === id));
    const state: Elections2022State = {
      updatedAt: new Date().toISOString(),
      councils: [...kept, ...found].sort((a, b) => a.councilId.localeCompare(b.councilId)),
      notFound: [...keptMissing, ...notFound].sort(),
    };
    await ctx.setState("elections-2022", state);
    ctx.count("councils", found.length);
    ctx.count("covered", found.filter((f) => !f.problems.length).length);
    if (notFound.length) throw new PartialFailure(`no May 2022 council election found for ${notFound.join(", ")}`);
  },
};
