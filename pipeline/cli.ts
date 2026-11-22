/**
 * Pipeline command line. Copied from OpenSenedd and adapted.
 *
 *   pnpm pipeline <job> [--flag value ...]
 *   pnpm pipeline daily            # everything the nightly schedule runs
 *   pnpm pipeline list             # show available jobs
 *   pnpm pipeline daily --council cardiff
 *
 * Each job records its outcome in the pipeline_runs table. When jobs change
 * data, the CLI tells the website which cached pages to refresh (if
 * SITE_URL and REVALIDATE_SECRET are set).
 */
import "dotenv/config";
import { closePipelineDb, runJob, type Job } from "./lib/job";
import { seedJob } from "./jobs/seed";
import { committeesJob } from "./jobs/committees";
import { councillorsJob } from "./jobs/councillors";
import { meetingDetailsJob, meetingsJob } from "./jobs/meetings";
import { summariesJob } from "./jobs/summaries";
import { ldpFindJob, ldpJob, ldpPeekJob, ldpReportJob } from "./jobs/ldp";
import { ldpAreasJob } from "./jobs/ldp-areas";
import { ldpWatchJob } from "./jobs/ldp-watch";
import { planningHistoryJob } from "./jobs/planning-history";
import { planningProbeJob } from "./jobs/planning-probe";
import { planningOfficialJob } from "./jobs/planning-official";
import { topicBriefsJob } from "./jobs/topic-briefs";
import { councilBriefsJob } from "./jobs/council-briefs";
import { councilPapersJob } from "./jobs/council-papers";
import { indexJob } from "./jobs/index";
import { probeJob } from "./jobs/probe";
import { peekJob } from "./jobs/peek";
import { compositionsJob } from "./jobs/compositions";
import { climateJob } from "./jobs/climate";
import { wdtkJob } from "./jobs/wdtk";
import { placesJob } from "./jobs/places";
import { revalidateSite } from "./lib/revalidate";
import { DAILY_SEQUENCE } from "./sequences";
import { councilDataJob } from "./jobs/council-data";
import { digestJob } from "./jobs/digest";
import { planningJob } from "./jobs/planning";
import { statsWalesProbeJob } from "./jobs/statswales-probe";
import { performanceJob } from "./jobs/performance";
import { historyJob } from "./jobs/history";
import { byElectionsJob } from "./jobs/by-elections";
import { electionResultsJob } from "./jobs/election-results";
import { browserProbeJob } from "./jobs/browser-probe";
import { idoxProbeJob } from "./jobs/idox-probe";
import { idoxJob } from "./jobs/idox";
import { planningRegisterJob } from "./jobs/planning-register";
import { arcusJob } from "./jobs/arcus";
import { consultationsJob } from "./jobs/consultations";
import { valeJob } from "./jobs/vale";
import { issuesJob } from "./jobs/issues";
import { alertsJob } from "./jobs/alerts";
import { regroundJob } from "./jobs/summaries";
import { welshFixesJob } from "./jobs/welsh-fixes";
import { checksJob } from "./jobs/checks";
import { executivePostsJob } from "./jobs/executive-posts";
import { forwardPlansJob } from "./jobs/forward-plans";
import { watchdogsJob } from "./jobs/watchdogs";
import { censusJob } from "./jobs/census";

const JOBS: Record<string, Job> = {
  seed: seedJob,
  committees: committeesJob,
  councillors: councillorsJob,
  meetings: meetingsJob,
  "meeting-details": meetingDetailsJob,
  summaries: summariesJob,
  ldp: ldpJob,
  "ldp-report": ldpReportJob,
  "ldp-find": ldpFindJob,
  "ldp-peek": ldpPeekJob,
  "ldp-areas": ldpAreasJob,
  "ldp-watch": ldpWatchJob,
  "planning-history": planningHistoryJob,
  "planning-probe": planningProbeJob,
  "planning-official": planningOfficialJob,
  "topic-briefs": topicBriefsJob,
  "council-briefs": councilBriefsJob,
  "council-papers": councilPapersJob,
  index: indexJob,
  probe: probeJob,
  peek: peekJob,
  compositions: compositionsJob,
  climate: climateJob,
  wdtk: wdtkJob,
  places: placesJob,
  "council-data": councilDataJob,
  digest: digestJob,
  planning: planningJob,
  "statswales-probe": statsWalesProbeJob,
  performance: performanceJob,
  history: historyJob,
  "by-elections": byElectionsJob,
  "election-results": electionResultsJob,
  "browser-probe": browserProbeJob,
  "idox-probe": idoxProbeJob,
  idox: idoxJob,
  "planning-register": planningRegisterJob,
  arcus: arcusJob,
  consultations: consultationsJob,
  vale: valeJob,
  issues: issuesJob,
  alerts: alertsJob,
  reground: regroundJob,
  "welsh-fixes": welshFixesJob,
  checks: checksJob,
  "executive-posts": executivePostsJob,
  "forward-plans": forwardPlansJob,
  watchdogs: watchdogsJob,
  census: censusJob,
};

const SEQUENCES: Record<string, string[]> = {
  daily: [...DAILY_SEQUENCE],
  // Three times a day: new planning applications, then alerts about them.
  "planning-alerts": ["planning", "idox", "planning-register", "arcus", "alerts"],
  // History: `pnpm pipeline backfill --council cardiff --from 2022-05-01`.
  // Safe to run again: meetings already settled are skipped.
  backfill: ["seed", "committees", "councillors", "meetings", "meeting-details", "summaries", "index"],
  // Every six hours: one more council's meeting history, then older planning applications.
  "history-runs": ["history"],
};

export function registerJob(job: Job) {
  JOBS[job.name] = job;
}

export function registerSequence(name: string, steps: string[]) {
  SEQUENCES[name] = steps;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else positional.push(a);
  }
  return { args, positional };
}

async function main() {
  const { args, positional } = parseArgs(process.argv.slice(2));
  const name = positional[0];
  if (!name || name === "list" || name === "help") {
    console.log("Jobs:");
    for (const j of Object.values(JOBS))
      console.log(`  ${j.name.padEnd(14)} ${j.description}`);
    console.log("Sequences:");
    for (const [k, v] of Object.entries(SEQUENCES))
      console.log(`  ${k.padEnd(14)} ${v.join(" → ")}`);
    return;
  }
  const steps = SEQUENCES[name] ?? [name];
  const touched = new Set<string>();
  let worst: "ok" | "partial" | "failed" = "ok";
  for (const step of steps) {
    const job = JOBS[step];
    if (!job) throw new Error(`Unknown job: ${step}`);
    const r = await runJob(job, args, touched);
    if (r.status === "failed") worst = "failed";
    else if (r.status === "partial" && worst === "ok") worst = "partial";
    // A failed step doesn't stop a sequence: later steps work from whatever
    // data is already in the database, and each failure is recorded.
  }
  if (touched.size && args["no-revalidate"] !== true)
    await revalidateSite([...touched]);
  await closePipelineDb();
  if (worst === "failed") process.exitCode = 1;
}

main().catch(async (err) => {
  console.error(err);
  await closePipelineDb().catch(() => {});
  process.exit(1);
});
