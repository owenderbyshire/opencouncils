/**
 * The May 2027 council elections: who runs each council, who leads it, and
 * the 2022 results. Compiled on 27 October 2026 from the sources listed with
 * each entry (pipeline research in data/curated/elections-research.json).
 * Seats held now come from the councils' own lists of councillors, in the
 * database, not from here. Party ids follow src/lib/parties.ts; local groups
 * keep their own names.
 */

export const ELECTION_DAY = "2027-05-06";
export const ELECTIONS_AS_OF = "2026-10-27";

export type ControlKind = "majority" | "minority" | "noc" | "disputed";

export interface CouncilElection {
  id: string;
  /** majority: one party has most seats; minority: one party runs it without a majority; noc: no overall control, led by `party`; disputed: sources differ. */
  control: { kind: ControlKind; party: string };
  leader: { name: string; party: string; since: string | null };
  noteEn: string | null;
  noteCy: string | null;
  controlSources: string[];
  election2022: { seats: Record<string, number>; total: number; source: string };
}

export const COUNCIL_ELECTIONS: CouncilElection[] = [
  {
    "id": "blaenau-gwent",
    "control": {
      "kind": "majority",
      "party": "lab"
    },
    "leader": {
      "name": "Stephen Thomas",
      "party": "lab",
      "since": "2022-05-26"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Blaenau_Gwent_County_Borough_Council"
    ],
    "election2022": {
      "seats": {
        "lab": 21,
        "ind": 12
      },
      "total": 33,
      "source": "https://en.wikipedia.org/wiki/2022_Blaenau_Gwent_County_Borough_Council_election"
    }
  },
  {
    "id": "bridgend",
    "control": {
      "kind": "minority",
      "party": "lab"
    },
    "leader": {
      "name": "John Spanswick",
      "party": "lab",
      "since": "2024-05-15"
    },
    "noteEn": "Labour holds 25 of 51 seats, one short of a majority. Some sources still describe a Labour majority.",
    "noteCy": "Mae gan Lafur 25 o'r 51 sedd, un yn brin o fwyafrif. Mae rhai ffynonellau'n dal i ddisgrifio mwyafrif Llafur.",
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://opencouncildata.co.uk/councils.php?model=W&y=0",
      "https://en.wikipedia.org/wiki/Bridgend_County_Borough_Council"
    ],
    "election2022": {
      "seats": {
        "lab": 27,
        "ind": 21,
        "pc": 2,
        "con": 1
      },
      "total": 51,
      "source": "https://en.wikipedia.org/wiki/2022_Bridgend_County_Borough_Council_election"
    }
  },
  {
    "id": "caerphilly",
    "control": {
      "kind": "majority",
      "party": "lab"
    },
    "leader": {
      "name": "Jamie Pritchard",
      "party": "lab",
      "since": "2025-11-11"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Caerphilly_County_Borough_Council"
    ],
    "election2022": {
      "seats": {
        "lab": 45,
        "pc": 18,
        "ind": 6
      },
      "total": 69,
      "source": "https://en.wikipedia.org/wiki/2022_Caerphilly_County_Borough_Council_election"
    }
  },
  {
    "id": "cardiff",
    "control": {
      "kind": "majority",
      "party": "lab"
    },
    "leader": {
      "name": "Chris Weaver",
      "party": "lab",
      "since": "2026-05-22"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Cardiff_Council",
      "https://www.hellorayo.co.uk/hits-radio/south-wales/news/chris-weaver-set-to-become-cardiff-council-leader"
    ],
    "election2022": {
      "seats": {
        "lab": 55,
        "con": 11,
        "ld": 10,
        "common_ground": 2,
        "propel": 1
      },
      "total": 79,
      "source": "https://en.wikipedia.org/wiki/2022_Cardiff_Council_election"
    }
  },
  {
    "id": "carmarthenshire",
    "control": {
      "kind": "disputed",
      "party": "pc"
    },
    "leader": {
      "name": "Linda Evans",
      "party": "pc",
      "since": "2025-11-13"
    },
    "noteEn": "Sources differ. Open Council Data counts Plaid Cymru on 39 of 75 seats, a bare majority, after a by-election in October 2026. Others describe a Plaid Cymru and Independent coalition.",
    "noteCy": "Mae'r ffynonellau'n wahanol. Mae Open Council Data yn cyfrif 39 o'r 75 sedd i Blaid Cymru, mwyafrif bach, ar ôl isetholiad ym mis Hydref 2026. Mae eraill yn disgrifio clymblaid Plaid Cymru ac Annibynwyr.",
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Carmarthenshire_County_Council",
      "https://newsroom.carmarthenshire.gov.wales/2025/12/carmarthenshire-county-council-welcomes-new-leader",
      "https://opencouncildata.co.uk/councils.php?model=W&y=0"
    ],
    "election2022": {
      "seats": {
        "pc": 38,
        "lab": 23,
        "ind": 14
      },
      "total": 75,
      "source": "https://en.wikipedia.org/wiki/2022_Carmarthenshire_County_Council_election"
    }
  },
  {
    "id": "ceredigion",
    "control": {
      "kind": "majority",
      "party": "pc"
    },
    "leader": {
      "name": "Bryan Davies",
      "party": "pc",
      "since": "2022-05-13"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Ceredigion_County_Council"
    ],
    "election2022": {
      "seats": {
        "pc": 20,
        "ind": 9,
        "ld": 7,
        "lab": 1,
        "gwlad": 1
      },
      "total": 38,
      "source": "https://en.wikipedia.org/wiki/2022_Ceredigion_County_Council_election"
    }
  },
  {
    "id": "conwy",
    "control": {
      "kind": "noc",
      "party": "ind"
    },
    "leader": {
      "name": "Julie Fallon",
      "party": "ind",
      "since": "2025-10-08"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Conwy_County_Borough_Council"
    ],
    "election2022": {
      "seats": {
        "ind": 22,
        "lab": 11,
        "con": 10,
        "pc": 7,
        "ld": 4,
        "green": 1
      },
      "total": 55,
      "source": "https://en.wikipedia.org/wiki/2022_Conwy_County_Borough_Council_election"
    }
  },
  {
    "id": "denbighshire",
    "control": {
      "kind": "noc",
      "party": "ind"
    },
    "leader": {
      "name": "Hugh Evans",
      "party": "ind",
      "since": null
    },
    "noteEn": "The Labour leader stood down at the end of August 2026. The council's website names Hugh Evans as leader. Who is in the new administration isn't confirmed.",
    "noteCy": "Camodd yr arweinydd Llafur i lawr ddiwedd Awst 2026. Mae gwefan y cyngor yn enwi Hugh Evans fel arweinydd. Dydy hi ddim wedi'i chadarnhau pwy sydd yn y weinyddiaeth newydd.",
    "controlSources": [
      "https://sirddinbych.gov.uk/en/your-council/about-the-council/how-the-council-works/the-leader-cabinet-and-elected-councillors.aspx",
      "https://en.wikipedia.org/wiki/Denbighshire_County_Council",
      "https://nation.cymru/news/councils-new-leaders-vow-to-tackle-recycling-problems-and-revisit-bridge-plans/",
      "https://www.wlga.wales/leadership-meetings/executive-board/"
    ],
    "election2022": {
      "seats": {
        "lab": 19,
        "ind": 12,
        "pc": 8,
        "con": 6,
        "green": 2,
        "ld": 1
      },
      "total": 48,
      "source": "https://en.wikipedia.org/wiki/2022_Denbighshire_County_Council_election"
    }
  },
  {
    "id": "flintshire",
    "control": {
      "kind": "noc",
      "party": "lab"
    },
    "leader": {
      "name": "Dave Hughes",
      "party": "lab",
      "since": "2024-09-24"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Flintshire_County_Council",
      "https://opencouncildata.co.uk/councils.php?model=W&y=0"
    ],
    "election2022": {
      "seats": {
        "lab": 31,
        "ind": 30,
        "ld": 4,
        "con": 2
      },
      "total": 67,
      "source": "https://en.wikipedia.org/wiki/2022_Flintshire_County_Council_election"
    }
  },
  {
    "id": "gwynedd",
    "control": {
      "kind": "majority",
      "party": "pc"
    },
    "leader": {
      "name": "Nia Wyn Jeffreys",
      "party": "pc",
      "since": "2024-12-05"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Gwynedd_Council"
    ],
    "election2022": {
      "seats": {
        "pc": 44,
        "ind": 23,
        "lab": 1,
        "ld": 1
      },
      "total": 69,
      "source": "https://en.wikipedia.org/wiki/2022_Gwynedd_Council_election"
    }
  },
  {
    "id": "anglesey",
    "control": {
      "kind": "majority",
      "party": "pc"
    },
    "leader": {
      "name": "Gary Pritchard",
      "party": "pc",
      "since": "2024-09-26"
    },
    "noteEn": "Plaid Cymru holds 18 of 35 seats, exactly enough for a majority.",
    "noteCy": "Mae gan Blaid Cymru 18 o'r 35 sedd, yn union ddigon am fwyafrif.",
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Isle_of_Anglesey_County_Council"
    ],
    "election2022": {
      "seats": {
        "pc": 21,
        "ind": 10,
        "lab": 3,
        "ld": 1
      },
      "total": 35,
      "source": "https://en.wikipedia.org/wiki/2022_Isle_of_Anglesey_County_Council_election"
    }
  },
  {
    "id": "merthyr-tydfil",
    "control": {
      "kind": "minority",
      "party": "lab"
    },
    "leader": {
      "name": "Brent Carter",
      "party": "lab",
      "since": "2024-09-18"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Merthyr_Tydfil_County_Borough_Council",
      "https://www.merthyr.gov.uk/news-and-events/latest-news/labour-led-administration-takes-over-political-leadership-of-merthyr-tydfil-county-borough-council"
    ],
    "election2022": {
      "seats": {
        "ind": 15,
        "lab": 15
      },
      "total": 30,
      "source": "https://en.wikipedia.org/wiki/2022_Merthyr_Tydfil_County_Borough_Council_election"
    }
  },
  {
    "id": "monmouthshire",
    "control": {
      "kind": "noc",
      "party": "lab"
    },
    "leader": {
      "name": "Mary Ann Brocklesby",
      "party": "lab",
      "since": "2022-05-19"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Monmouthshire_County_Council",
      "https://opencouncildata.co.uk/councils.php?model=W&y=0"
    ],
    "election2022": {
      "seats": {
        "lab": 22,
        "con": 18,
        "ind": 5,
        "green": 1
      },
      "total": 46,
      "source": "https://en.wikipedia.org/wiki/2022_Monmouthshire_County_Council_election"
    }
  },
  {
    "id": "neath-port-talbot",
    "control": {
      "kind": "noc",
      "party": "ind"
    },
    "leader": {
      "name": "Scott Jones",
      "party": "ind",
      "since": "2026-10-14"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://swanseabaynews.com/neath-port-talbot-scott-jones-new-council-leader-steve-hunt/",
      "https://herald.wales/south-wales/neath/new-council-leader-elected-in-neath-port-talbot/",
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Neath_Port_Talbot_County_Borough_Council"
    ],
    "election2022": {
      "seats": {
        "lab": 27,
        "ind": 18,
        "pc": 12,
        "ld": 2,
        "green": 1
      },
      "total": 60,
      "source": "https://en.wikipedia.org/wiki/2022_Neath_Port_Talbot_County_Borough_Council_election"
    }
  },
  {
    "id": "newport",
    "control": {
      "kind": "majority",
      "party": "lab"
    },
    "leader": {
      "name": "Dimitri Batrouni",
      "party": "lab",
      "since": "2024-05-21"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Newport_City_Council"
    ],
    "election2022": {
      "seats": {
        "lab": 35,
        "con": 7,
        "ind": 4,
        "newport_independents": 3,
        "ld": 1,
        "green": 1
      },
      "total": 51,
      "source": "https://en.wikipedia.org/wiki/2022_Newport_City_Council_election"
    }
  },
  {
    "id": "pembrokeshire",
    "control": {
      "kind": "noc",
      "party": "ind"
    },
    "leader": {
      "name": "Tessa Hodgson",
      "party": "ind",
      "since": "2026-05-15"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Pembrokeshire_County_Council"
    ],
    "election2022": {
      "seats": {
        "ind": 35,
        "con": 11,
        "lab": 10,
        "pc": 2,
        "ld": 2
      },
      "total": 60,
      "source": "https://en.wikipedia.org/wiki/2022_Pembrokeshire_County_Council_election"
    }
  },
  {
    "id": "powys",
    "control": {
      "kind": "noc",
      "party": "ld"
    },
    "leader": {
      "name": "Jake Berriman",
      "party": "ld",
      "since": "2025-05-15"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Powys_County_Council"
    ],
    "election2022": {
      "seats": {
        "ld": 24,
        "ind": 17,
        "con": 14,
        "lab": 9,
        "pc": 3,
        "green": 1
      },
      "total": 68,
      "source": "https://en.wikipedia.org/wiki/2022_Powys_County_Council_election"
    }
  },
  {
    "id": "rhondda-cynon-taf",
    "control": {
      "kind": "majority",
      "party": "lab"
    },
    "leader": {
      "name": "Ann Crimmings",
      "party": "lab",
      "since": "2026-04-29"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://www.rctcbc.gov.uk/EN/Newsroom/PressReleases/2026/April/CouncillorAnnCrimmingselectedLeaderofRhonddaCynonTafCouncil.aspx"
    ],
    "election2022": {
      "seats": {
        "lab": 59,
        "pc": 8,
        "ind": 6,
        "con": 2
      },
      "total": 75,
      "source": "https://en.wikipedia.org/wiki/2022_Rhondda_Cynon_Taf_County_Borough_Council_election"
    }
  },
  {
    "id": "swansea",
    "control": {
      "kind": "majority",
      "party": "lab"
    },
    "leader": {
      "name": "Rob Stewart",
      "party": "lab",
      "since": "2014-09-09"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Swansea_Council"
    ],
    "election2022": {
      "seats": {
        "lab": 45,
        "ld": 11,
        "con": 7,
        "ind": 5,
        "uplands": 4,
        "independents_at_swansea": 2,
        "green": 1
      },
      "total": 75,
      "source": "https://en.wikipedia.org/wiki/2022_Swansea_Council_election"
    }
  },
  {
    "id": "torfaen",
    "control": {
      "kind": "majority",
      "party": "lab"
    },
    "leader": {
      "name": "Anthony Hunt",
      "party": "lab",
      "since": "2017-01-01"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Torfaen_County_Borough_Council"
    ],
    "election2022": {
      "seats": {
        "lab": 30,
        "ind": 10
      },
      "total": 40,
      "source": "https://en.wikipedia.org/wiki/2022_Torfaen_County_Borough_Council_election"
    }
  },
  {
    "id": "vale-of-glamorgan",
    "control": {
      "kind": "noc",
      "party": "lab"
    },
    "leader": {
      "name": "Lis Burnett",
      "party": "lab",
      "since": "2022-05-23"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Vale_of_Glamorgan_Council"
    ],
    "election2022": {
      "seats": {
        "lab": 25,
        "con": 13,
        "pc": 8,
        "llantwit_first_independents": 4,
        "ind": 4
      },
      "total": 54,
      "source": "https://en.wikipedia.org/wiki/2022_Vale_of_Glamorgan_Council_election"
    }
  },
  {
    "id": "wrexham",
    "control": {
      "kind": "noc",
      "party": "ind"
    },
    "leader": {
      "name": "Mark Pritchard",
      "party": "ind",
      "since": "2014-09-24"
    },
    "noteEn": null,
    "noteCy": null,
    "controlSources": [
      "https://www.wlga.wales/leadership-meetings/executive-board/",
      "https://en.wikipedia.org/wiki/Wrexham_County_Borough_Council"
    ],
    "election2022": {
      "seats": {
        "ind": 23,
        "lab": 14,
        "con": 9,
        "pc": 9,
        "ld": 1
      },
      "total": 56,
      "source": "https://en.wikipedia.org/wiki/2022_Wrexham_County_Borough_Council_election"
    }
  }
];

export const electionFor = (id: string) => COUNCIL_ELECTIONS.find((c) => c.id === id);

/** Councils with new wards for 2027, and their new number of councillors where confirmed. */
export const BOUNDARY_CHANGES: Array<{ id: string; seats: number | null }> = [
  { id: "vale-of-glamorgan", seats: 59 },
  { id: "caerphilly", seats: 68 },
  { id: "carmarthenshire", seats: null },
];

/** The Senedd election of 7 May 2026: a guide to party support, not a council result. */
export const SENEDD_2026 = {
  "date": "2026-05-07",
  "turnout": 51.6,
  "results": [
    {
      "party": "pc",
      "seats": 43,
      "share": 35.41
    },
    {
      "party": "reform",
      "seats": 34,
      "share": 29.3
    },
    {
      "party": "lab",
      "seats": 9,
      "share": 11.08
    },
    {
      "party": "con",
      "seats": 7,
      "share": 10.74
    },
    {
      "party": "green",
      "seats": 2,
      "share": 6.74
    },
    {
      "party": "ld",
      "seats": 1,
      "share": 4.46
    },
    {
      "party": "other",
      "seats": 0,
      "share": 2.27
    }
  ],
  "sources": [
    "https://en.wikipedia.org/wiki/2026_Senedd_election",
    "https://www.itv.com/news/wales/2026-05-07/senedd-election-2026-the-full-results",
    "https://research.senedd.wales/research-articles/senedd-election-an-initial-analysis-of-the-results/"
  ]
};

/** Senedd voting intention polls since May 2026, newest first. `date` is the last day of fieldwork, or the day published when fieldwork dates weren't given. No poll of voting intention for the council elections has been published. */
export const SENEDD_POLLS = [
  {
    "pollster": "More in Common",
    "client": "Cavendish Cymru and Senedd Sources",
    "fieldwork": "24-30 Sep 2026",
    "date": "2026-09-30",
    "sample": null,
    "shares": {
      "pc": 32,
      "reform": 27,
      "lab": 18,
      "con": 12,
      "green": 6,
      "ld": 5,
      "other": 1
    },
    "source": "https://www.moreincommon.org.uk/research/plaid-cymru-governing-a-fragmented-wales/"
  },
  {
    "pollster": "YouGov",
    "client": "ITV Cymru Wales (Barn Cymru)",
    "fieldwork": null,
    "date": "2026-09-15",
    "sample": null,
    "shares": {
      "pc": 32,
      "reform": 27,
      "lab": 13,
      "con": 11,
      "green": 7,
      "ld": 5,
      "other": 5
    },
    "source": "https://www.itv.com/news/wales/2026-09-15/welsh-support-grows-for-burnhams-labour-as-plaid-stays-top-in-senedd"
  }
];

/**
 * Council by-elections in Wales since May 2022, from Open Council Data's
 * yearly lists (which it says may be incomplete). Counts were checked by
 * hand on 27 October 2026; party gains and losses aren't shown, because the
 * source counts defections and label changes inconsistently.
 */
export const BY_ELECTIONS = {
  "approxCount": 90,
  "sources": [
    "https://opencouncildata.co.uk/changesC.php?y=2022",
    "https://opencouncildata.co.uk/changesC.php?y=2023",
    "https://opencouncildata.co.uk/changesC.php?y=2024",
    "https://opencouncildata.co.uk/changesC.php?y=2025",
    "https://opencouncildata.co.uk/changesC.php?y=2026"
  ],
  "asOf": "2026-10-27"
};
