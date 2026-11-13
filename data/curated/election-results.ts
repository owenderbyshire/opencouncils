/**
 * The id of the May 2022 council election in each council's ModernGov web
 * service (GetElectionResults?lElectionId=N), found by trying ids in turn on
 * 12 November 2026 (pipeline/jobs/election-results.ts). The job checks each
 * id still gives a May 2022 council election before using it, and searches
 * again if not. A council left out here is searched for every run; set it to
 * null to stop looking (for a service that holds no 2022 results).
 */
export const ELECTION_2022_IDS: Record<string, number | null | undefined> = {
  anglesey: 17,
  cardiff: 66,
  ceredigion: 6,
  conwy: 105,
  denbighshire: 92,
  flintshire: 80,
  gwynedd: 9,
  "neath-port-talbot": 91,
  swansea: 41,
};
