/**
 * Strings for OpenCouncils' UK-wide pages: the home page, the list of every
 * council and the reorganisation tracker. English only: OpenCouncils serves no
 * Welsh pages, so the Welsh entries repeat the English to satisfy the type.
 */
import { defineMessages } from "../server";

const en = {
  home: {
    title: "Every council in the UK, in one place",
    lede: "Who runs each council, what it is deciding and what the watchdogs say. {n} councils across England, Scotland, Wales and Northern Ireland.",
    byNation: "Councils by nation",
    nationNote: "Principal councils: the ones that run services such as social care, bins, planning and council tax. Town, parish and community councils are not covered.",
    coverageTitle: "What we hold so far",
    coverage: "We are connecting each council's meetings, councillors and decisions, starting with the {n} councils whose records we have already checked. Every other council has a register page until then.",
    browse: "See every council",
    reorgTitle: "Councils being reorganised",
    reorg: "England is replacing many county and district councils with single unitary councils. Surrey's new councils start on 1 April 2027. The government paused most other changes for a review on 7 September 2026.",
    reorgLink: "Follow reorganisation",
    electionsTitle: "Elections in May 2027",
    elections: "Council elections are due across Scotland, Wales and Northern Ireland, and in much of England, in May 2027.",
  },
  index: {
    title: "All UK councils",
    lede: "Every principal council in the UK, from the official register of local authorities. Filter by nation or type of council.",
    nation: "Nation",
    kind: "Type",
    all: "All",
    count: "{n} councils",
    colCouncil: "Council",
    colType: "Type",
    colNation: "Nation",
    colPopulation: "Population",
    colRecords: "Records",
    full: "Connected",
    registerOnly: "Register only",
    ending: "Ends {date}",
    source: "Source: [mySociety's UK local authority register](source), built from official ONS, OS and government registers. Population figures are 2020 estimates.",
  },
  kinds: {
    county: "County councils",
    district: "District councils",
    metropolitan: "Metropolitan districts",
    "london-borough": "London boroughs",
    unitary: "Unitary councils",
    "city-corporation": "City of London",
    combined: "Combined authorities",
  },
  kindExplain: {
    county: "Runs county-wide services such as schools, social care and roads, alongside district councils.",
    district: "Runs local services such as bins, housing and planning, alongside a county council (in Northern Ireland, councils with narrower powers).",
    metropolitan: "A single-tier council in one of England's big city regions.",
    "london-borough": "One of London's 32 borough councils, alongside the Greater London Authority.",
    unitary: "A single-tier council running all local services in its area.",
    "city-corporation": "The City of London Corporation, which runs the Square Mile.",
    combined: "A group of councils working together, often with an elected mayor.",
  },
  reorg: {
    title: "Councils being reorganised",
    lede: "Reorganisation replaces county and district councils with single unitary councils. This page lists the changes that are confirmed, with the councils each one replaces.",
    status: { confirmed: "Confirmed", paused: "Paused for review", withdrawn: "Withdrawn" },
    starts: "New councils start on {date}.",
    shadow: "Elections to the new councils were held on {date}.",
    replaces: "Replaces",
    review: "On 7 September 2026 the government launched a rapid review of the reorganisation programme after new legal advice, and withdrew four decisions. Surrey is not affected. Elections in May 2027 go ahead on existing boundaries. We will add other areas here once decisions are confirmed.",
    sources: "Sources",
  },
  council: {
    registerTitle: "{name}",
    registerLede: "{type} in {nation}.",
    notYet: "We have not connected this council's records yet. When we do, its meetings, councillors and decisions will appear here.",
    facts: "About this council",
    gss: "ONS code",
    population: "Population (2020 estimate)",
    county: "County council",
    combined: "Combined authority",
    since: "Since",
    ends: "Ends",
    replacedBy: "Replaced by",
    replaces: "Replaces",
    website: "Council website",
    records: "Meetings and minutes",
  },
};

export const ukMessages = defineMessages<typeof en>({ en, cy: en });
