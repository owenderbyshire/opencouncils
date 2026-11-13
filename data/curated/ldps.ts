/**
 * Each planning authority's Local Development Plan (LDP): the plan in force,
 * its replacement and the latest Annual Monitoring Report. Every block names
 * the official page it was checked against. Checked November 2026; plans move
 * on, so `checked` says when each row was last confirmed.
 *
 * The `ldp` pipeline job downloads the documents listed here and reads the
 * headline figures and allocated sites out of them (pipeline/jobs/ldp.ts).
 */

export const LDP_STAGES = [
  "none",
  "review",
  "delivery-agreement",
  "candidate-sites",
  "preferred-strategy",
  "deposit",
  "submitted",
  "examination",
  "adopted",
  "paused",
] as const;
export type LdpStage = (typeof LDP_STAGES)[number];

export interface LdpRecord {
  /** The planning authority's id (data/curated/planning-authorities.ts). */
  id: string;
  adopted: {
    title: string;
    /** Null when the plan gives only an end year. */
    periodStart: number | null;
    periodEnd: number;
    /** YYYY-MM-DD. */
    adoptedDate: string | null;
    pageUrl: string;
    /** The written statement: one PDF, or several when the authority splits it. */
    writtenStatement: string[];
    writtenStatementCy: string[];
    mapUrl: string | null;
    source: string;
  };
  replacement: {
    title: string | null;
    periodStart: number | null;
    periodEnd: number | null;
    stage: LdpStage;
    /** YYYY-MM or YYYY-MM-DD. */
    stageDate: string | null;
    /** The next stage the authority is working towards. */
    nextStage: LdpStage | null;
    /** When the authority's current timetable expects it: "2027-03" or "2027". Null if no current date is published. */
    nextDate: string | null;
    /** The published timetable's dates have passed and no new ones have been published. */
    slipped: boolean;
    pageUrl: string | null;
    deposit: string[];
    source: string | null;
  };
  amr: {
    /** "2024-25". */
    year: string | null;
    url: string | null;
    source: string | null;
  };
  /** Allocated sites as map data, when the authority publishes them. */
  gisUrl: string | null;
  /** Something a reader should know, in both languages. */
  noteEn: string | null;
  noteCy: string | null;
  /** YYYY-MM-DD. */
  checked: string;
}

export const LDPS: LdpRecord[] = [
  {
    "id": "anglesey",
    "adopted": {
      "title": "Anglesey and Gwynedd Joint Local Development Plan 2011 - 2026",
      "periodStart": 2011,
      "periodEnd": 2026,
      "adoptedDate": "2017-07-31",
      "pageUrl": "https://anglesey.gov.wales/en/Residents/Planning-building-control-and-conservation/Planning-policy/Joint-Local-Planning-Policy/Current-Joint-Local-Development-Plan.aspx",
      "writtenStatement": [
        "https://www.gwynedd.llyw.cymru/en/Council/Documents---Council/Strategies-and-policies/Environment-and-planning/Planning-policy/Anglesey-and-Gwynedd-Joint-Local-Development-Plan-Written-Statement.pdf"
      ],
      "writtenStatementCy": [
        "https://www.gwynedd.llyw.cymru/cy/Cyngor/Dogfennau-Cyngor/Strategaethau-a-pholisiau/Cynllunio-ac-amgylchedd/Polisi-cynllunio/Cynllun-Datblygu-Lleol-ar-y-Cyd-Gwynedd-a-M%C3%B4n-Datganiad-Ysgrifenedig.pdf"
      ],
      "mapUrl": "https://www.gwynedd.llyw.cymru/en/Council/Documents---Council/Strategies-and-policies/Environment-and-planning/Planning-policy/J.L.D.P-ANGLESEY-11-2017/1.-Map-cynigion-Ynys-M%C3%B4n.pdf",
      "source": "https://anglesey.gov.wales/en/Residents/Planning-building-control-and-conservation/Planning-policy/Joint-Local-Planning-Policy/Current-Joint-Local-Development-Plan.aspx ; https://www.gwynedd.llyw.cymru/en/Council/Documents---Council/Strategies-and-policies/Environment-and-planning/Planning-policy/Anglesey-and-Gwynedd-Joint-Local-Development-Plan-Written-Statement.pdf ; https://www.gwynedd.llyw.cymru/en/Council/Strategies-and-policies/Environment-and-planning/Planning-policy/Joint-Local-Development-Plan/Joint-Local-Development-Plan-Current/Proposals-maps.aspx"
    },
    "replacement": {
      "title": "Anglesey Local Development Plan 2024-2039",
      "periodStart": 2024,
      "periodEnd": 2039,
      "stage": "candidate-sites",
      "stageDate": "2025-08",
      "nextStage": "preferred-strategy",
      "nextDate": null,
      "slipped": false,
      "pageUrl": "https://www.anglesey.gov.wales/en/Residents/Planning-building-control-and-conservation/Planning-policy/Local-Development-Plan/",
      "deposit": [],
      "source": "https://www.anglesey.gov.wales/en/Residents/Planning-building-control-and-conservation/Planning-policy/Local-Development-Plan/ ; https://anglesey.gov.wales/ldp-anglesey ; https://www.anglesey.gov.wales/en/Residents/Planning-building-control-and-conservation/Planning-policy/Local-Development-Plan/Call-for-sites.aspx ; https://cdll-ldp.ynysmon.llyw.cymru ; https://cdll-ldp.ynysmon.llyw.cymru/document/15"
    },
    "amr": {
      "year": "2024-25",
      "url": "https://www.anglesey.gov.wales/documents/Docs-en/Planning/Local-Development-Plan/Annual-monitoring-report/7-AMR.pdf",
      "source": "https://anglesey.gov.wales/en/Residents/Planning-building-control-and-conservation/Planning-policy/Joint-Local-Planning-Policy/Current-Joint-Local-Development-Plan.aspx"
    },
    "gisUrl": null,
    "noteEn": "Anglesey and Gwynedd share one joint plan, so the figures and sites below cover both areas. Each council is now writing its own replacement.",
    "noteCy": "Mae Ynys Môn a Gwynedd yn rhannu un cynllun ar y cyd, felly mae'r ffigurau a'r safleoedd isod yn cwmpasu'r ddwy ardal. Mae pob cyngor bellach yn ysgrifennu ei gynllun newydd ei hun.",
    "checked": "2026-11-02"
  },
  {
    "id": "bannau-brycheiniog",
    "adopted": {
      "title": "Brecon Beacons National Park Local Development Plan 2007-2022",
      "periodStart": 2007,
      "periodEnd": 2022,
      "adoptedDate": "2013-12-17",
      "pageUrl": "https://beacons-npa.gov.uk/planning/draft-strategy-and-policy/brecon-beacons-national-park-local-development-plan",
      "writtenStatement": [
        "http://www.beacons-npa.gov.uk/wp-content/uploads/Brecon-Written-Statement.pdf"
      ],
      "writtenStatementCy": [],
      "mapUrl": "http://www.beacons-npa.gov.uk/wp-content/uploads/Page-1-Proposals-Map-West.pdf",
      "source": "https://beacons-npa.gov.uk/planning/draft-strategy-and-policy/brecon-beacons-national-park-local-development-plan; https://beacons-npa.gov.uk/wp-content/uploads/BBNP-LDP-AMR-2023-24-FINAL-NEW-VERSION.pdf"
    },
    "replacement": {
      "title": "Bannau Brycheiniog (Brecon Beacons) National Park Local Development Plan 2025-2045",
      "periodStart": 2025,
      "periodEnd": 2045,
      "stage": "delivery-agreement",
      "stageDate": "2025-05",
      "nextStage": "preferred-strategy",
      "nextDate": null,
      "slipped": false,
      "pageUrl": "https://beacons-npa.gov.uk/planning/draft-strategy-and-policy/local-development-plan-review/",
      "deposit": [],
      "source": "https://beacons-npa.gov.uk/planning/draft-strategy-and-policy/local-development-plan-review/; https://bannau.oc2.uk/document/1/3; https://bannau.oc2.uk/; https://bannau.wales/the-authority/press-and-news/archive/june-2024/withdrawal-of-local-development-plan/"
    },
    "amr": {
      "year": "2023-24",
      "url": "https://beacons-npa.gov.uk/wp-content/uploads/BBNP-LDP-AMR-2023-24-FINAL-NEW-VERSION.pdf",
      "source": "https://beacons-npa.gov.uk/wp-content/uploads/BBNP-LDP-AMR-2023-24-FINAL-NEW-VERSION.pdf; https://beacons-npa.gov.uk/planning/draft-strategy-and-policy/annual-monitoring-report"
    },
    "gisUrl": null,
    "noteEn": "The authority withdrew its previous draft new plan in 2024, after work was paused over phosphate pollution in rivers. It consulted on a timetable for a new plan in 2025; the Welsh Government's agreement to it hasn't been published.",
    "noteCy": "Tynnodd yr awdurdod ei gynllun newydd drafft blaenorol yn ôl yn 2024, ar ôl i'r gwaith gael ei oedi oherwydd llygredd ffosffad mewn afonydd. Ymgynghorodd ar amserlen ar gyfer cynllun newydd yn 2025; nid yw cytundeb Llywodraeth Cymru iddi wedi'i gyhoeddi.",
    "checked": "2026-11-02"
  },
  {
    "id": "blaenau-gwent",
    "adopted": {
      "title": "Blaenau Gwent Local Development Plan up to 2021",
      "periodStart": 2006,
      "periodEnd": 2021,
      "adoptedDate": "2012-11-22",
      "pageUrl": "https://blaenau-gwent.gov.uk/en/resident/planning/local-development-plan/adopted-local-development-plan-2006-2021/adopted-ldp/",
      "writtenStatement": [
        "https://www.blaenau-gwent.gov.uk/media/szrml3sh/written-statement-without-appendices.pdf"
      ],
      "writtenStatementCy": [],
      "mapUrl": "https://blaenau-gwent.gov.uk/media/b50b5kev/full-doc_ldp_proposals_map.pdf",
      "source": "https://blaenau-gwent.gov.uk/en/resident/planning/local-development-plan/adopted-local-development-plan-2006-2021/adopted-ldp/; https://www.blaenau-gwent.gov.uk/media/szrml3sh/written-statement-without-appendices.pdf"
    },
    "replacement": {
      "title": "Blaenau Gwent and Torfaen Joint Local Development Plan (JLDP)",
      "periodStart": 2026,
      "periodEnd": 2041,
      "stage": "delivery-agreement",
      "stageDate": "2026-07",
      "nextStage": "candidate-sites",
      "nextDate": "2027",
      "slipped": false,
      "pageUrl": "https://www.bgtjointldp.org.uk/",
      "deposit": [],
      "source": "https://www.blaenau-gwent.gov.uk/en/resident/planning/local-development-plan/replacement-local-development-plan-2018-2033; https://www.torfaen.gov.uk/en/news/draft-timetable-for-joint-local-development-plan-agreed; https://torfaen.moderngov.co.uk/documents/s78524/Council Report on Draft JLDP Delivery Agreement - final.pdf"
    },
    "amr": {
      "year": "2025-26",
      "url": "https://www.blaenau-gwent.gov.uk/media/yupoimmj/amr-2025-2026.pdf",
      "source": "https://blaenau-gwent.gov.uk/en/resident/planning/local-development-plan/annual-studies/"
    },
    "gisUrl": null,
    "noteEn": "Blaenau Gwent stopped work on its own new plan in March 2026 and is writing a joint plan with Torfaen.",
    "noteCy": "Rhoddodd Blaenau Gwent y gorau i'r gwaith ar ei gynllun newydd ei hun ym mis Mawrth 2026 ac mae'n ysgrifennu cynllun ar y cyd â Thorfaen.",
    "checked": "2026-11-02"
  },
  {
    "id": "bridgend",
    "adopted": {
      "title": "Bridgend County Borough Replacement Local Development Plan 2018-2033",
      "periodStart": 2018,
      "periodEnd": 2033,
      "adoptedDate": "2024-03-13",
      "pageUrl": "https://www.bridgend.gov.uk/residents/planning-and-building-control/local-development-plan/adopted-replacement-local-development-plan-2018-2033",
      "writtenStatement": [
        "https://www.bridgend.gov.uk/media/izcfgp1f/written-statement.pdf"
      ],
      "writtenStatementCy": [],
      "mapUrl": "https://www.bridgend.gov.uk/media/o3wjxo42/proposals-map.pdf",
      "source": "https://www.bridgend.gov.uk/residents/planning-and-building-control/local-development-plan/adopted-replacement-local-development-plan-2018-2033; https://www.bridgend.gov.uk/media/jbxdi2i0/adoption-statement.pdf; https://www.bridgend.gov.uk/media/izcfgp1f/written-statement.pdf"
    },
    "replacement": {
      "title": null,
      "periodStart": null,
      "periodEnd": null,
      "stage": "none",
      "stageDate": null,
      "nextStage": null,
      "nextDate": null,
      "slipped": false,
      "pageUrl": null,
      "deposit": [],
      "source": "https://www.bridgend.gov.uk/residents/planning-and-building-control/local-development-plan/replacement-bridgend-local-development-plan-2018-to-2033/annual-monitoring-report/"
    },
    "amr": {
      "year": "2024-25",
      "url": "https://www.bridgend.gov.uk/media/eeml0ifv/annual-monitoring-report-2025.pdf",
      "source": "https://www.bridgend.gov.uk/residents/planning-and-building-control/local-development-plan/replacement-bridgend-local-development-plan-2018-to-2033/annual-monitoring-report/; https://democratic.bridgend.gov.uk/documents/s36189/AMR%20report.pdf?LLL=0"
    },
    "gisUrl": null,
    "noteEn": null,
    "noteCy": null,
    "checked": "2026-11-02"
  },
  {
    "id": "caerphilly",
    "adopted": {
      "title": "Caerphilly County Borough Local Development Plan up to 2021",
      "periodStart": 2006,
      "periodEnd": 2021,
      "adoptedDate": "2010-11-23",
      "pageUrl": "https://www.caerphilly.gov.uk/business/planning-and-building-control-for-business/local-development-plan/annual-monitoring-reports-(amr)",
      "writtenStatement": [
        "https://caerphilly.gov.uk/CaerphillyDocs/LDP/written-statement.aspx",
        "https://caerphilly.gov.uk/CaerphillyDocs/LDP/Appendices-to-Written-Statement.aspx"
      ],
      "writtenStatementCy": [
        "https://caerffili.gov.uk/CaerphillyDocs/LDP/written-statement-welsh.aspx"
      ],
      "mapUrl": null,
      "source": "https://caerffili.gov.uk/CaerphillyDocs/LDP/written-statement.aspx; https://caerffili.gov.uk/CaerphillyDocs/LDP/written-statement-welsh.aspx; https://caerphilly.gov.uk/business/planning-and-building-control-for-business/local-development-plan/annual-monitoring-reports-(amr)"
    },
    "replacement": {
      "title": "Caerphilly County Borough 2nd Replacement Local Development Plan 2020-2035",
      "periodStart": 2020,
      "periodEnd": 2035,
      "stage": "preferred-strategy",
      "stageDate": "2025-01",
      "nextStage": "deposit",
      "nextDate": "2026",
      "slipped": false,
      "pageUrl": "https://conversation.caerphilly.gov.uk/2rldp",
      "deposit": [],
      "source": "https://conversation.caerphilly.gov.uk/2rldp; https://democracy.caerphilly.gov.uk/mgConvert2PDF.aspx?ID=50208"
    },
    "amr": {
      "year": null,
      "url": "https://democracy.caerphilly.gov.uk/mgConvert2PDF.aspx?ID=56452",
      "source": "https://www.caerphilly.gov.uk/business/planning-and-building-control-for-business/local-development-plan/annual-monitoring-reports-(amr)"
    },
    "gisUrl": null,
    "noteEn": null,
    "noteCy": null,
    "checked": "2026-11-02"
  },
  {
    "id": "cardiff",
    "adopted": {
      "title": "Cardiff Local Development Plan 2006 to 2026",
      "periodStart": 2006,
      "periodEnd": 2026,
      "adoptedDate": "2016-01-28",
      "pageUrl": "https://www.cardiffldp.co.uk/adopted-local-development-plan/",
      "writtenStatement": [
        "https://www.cardiffldp.co.uk/wp-content/uploads/Final-Adopted-Local-Development-Plan-English.pdf"
      ],
      "writtenStatementCy": [],
      "mapUrl": null,
      "source": "https://cardiff.moderngov.co.uk/documents/s8726/Cabinet%2021%20Jan%202016%20LDP%20Appendix%203%20Adoption%20Statement.pdf; https://www.cardiffldp.co.uk/"
    },
    "replacement": {
      "title": "Cardiff Replacement Local Development Plan 2021-2036",
      "periodStart": 2021,
      "periodEnd": 2036,
      "stage": "examination",
      "stageDate": "2025-12",
      "nextStage": "adopted",
      "nextDate": null,
      "slipped": true,
      "pageUrl": "https://www.cardiffldp.co.uk/examination/",
      "deposit": [
        "https://www.cardiffldp.co.uk/wp-content/uploads/RLDP-07-Deposit-Plan-January-2025-ENGLISH.pdf"
      ],
      "source": "https://www.cardiffldp.co.uk/examination/submission-documents/; https://www.cardiffldp.co.uk/examination/; https://www.cardiffldp.co.uk/examination/hearing-sessions/; https://www.cardiffldp.co.uk/consultation/; https://www.cardiffldp.co.uk/timeline/; https://www.cardiffldp.co.uk/wp-content/uploads/RLDP-02-Revised-LDP-Delivery-Agreement-February-2025-ENGLISH-Final.pdf"
    },
    "amr": {
      "year": "2024-25",
      "url": "https://www.cardiffldp.co.uk/wp-content/uploads/2025-LDP-Annual-Monitoring-Report.pdf",
      "source": "https://www.cardiffldp.co.uk/annual-monitoring-report/; https://cardiff.moderngov.co.uk/documents/s89606/Cardiff%20LDP%20Appendix%201.pdf"
    },
    "gisUrl": null,
    "noteEn": "Public hearings on the new plan began in June 2026. Consultation on changes proposed after the hearings closes on 6 November 2026.",
    "noteCy": "Dechreuodd gwrandawiadau cyhoeddus ar y cynllun newydd ym mis Mehefin 2026. Mae'r ymgynghoriad ar newidiadau a gynigiwyd ar ôl y gwrandawiadau yn cau ar 6 Tachwedd 2026.",
    "checked": "2026-11-02"
  },
  {
    "id": "carmarthenshire",
    "adopted": {
      "title": "Carmarthenshire Local Development Plan 2006-2021",
      "periodStart": 2006,
      "periodEnd": 2021,
      "adoptedDate": "2014-12-10",
      "pageUrl": "https://www.carmarthenshire.gov.wales/home/council-services/planning/planning-policy/local-development-plan-2006-2021/",
      "writtenStatement": [],
      "writtenStatementCy": [],
      "mapUrl": "https://www.cartogold.co.uk/CarmarthenshireLDP/index.html",
      "source": "https://www.carmarthenshire.gov.wales/home/council-services/planning/planning-policy/local-development-plan-2006-2021/ ; https://www.carmarthenshire.gov.wales/media/yhjjyqi5/amr-2024-25-final-combined.pdf"
    },
    "replacement": {
      "title": "Revised Carmarthenshire Local Development Plan 2018-2033",
      "periodStart": 2018,
      "periodEnd": 2033,
      "stage": "examination",
      "stageDate": "2024-06",
      "nextStage": "adopted",
      "nextDate": null,
      "slipped": false,
      "pageUrl": "https://www.carmarthenshire.gov.wales/home/council-services/planning/local-development-plan-2018-2033",
      "deposit": [
        "https://www.carmarthenshire.gov.wales/media/1231094/2nd-deposit-revised-ldp-written-statement-eng.pdf"
      ],
      "source": "https://www.carmarthenshire.gov.wales/home/council-services/planning/local-development-plan-2018-2033 ; https://www.carmarthenshire.gov.wales/home/council-services/planning/local-development-plan-2018-2033/inspector-s-report-and-adoption/ ; https://democracy.carmarthenshire.gov.wales/ieListDocuments.aspx?CId=131&amp=&MId=10050 ; https://democracy.carmarthenshire.gov.wales/mgAi.aspx?ID=65073 ; https://www.carmarthenshire.gov.wales/home/council-services/planning/local-development-plan-2018-2033/second-deposit-revised-local-development-plan/"
    },
    "amr": {
      "year": "2024-25",
      "url": "https://www.carmarthenshire.gov.wales/media/yhjjyqi5/amr-2024-25-final-combined.pdf",
      "source": "https://www.carmarthenshire.gov.wales/home/council-services/planning/planning-policy/annual-monitoring-report-amr/"
    },
    "gisUrl": null,
    "noteEn": "The inspectors' report on the new plan was published on 20 October 2026. The council now decides whether to adopt it.",
    "noteCy": "Cyhoeddwyd adroddiad yr arolygwyr ar y cynllun newydd ar 20 Hydref 2026. Mae'r cyngor bellach yn penderfynu a ddylid ei fabwysiadu.",
    "checked": "2026-11-02"
  },
  {
    "id": "ceredigion",
    "adopted": {
      "title": "Ceredigion Local Development Plan (LDP1) 2007-2022",
      "periodStart": 2007,
      "periodEnd": 2022,
      "adoptedDate": "2013-04-25",
      "pageUrl": "https://ceredigion.gov.uk/resident/planning-building-control-and-sustainable-drainage-body-sab/planning-building-control/ceredigion-local-development-plan/adopted-ceredigion-local-development-plan-ldp/",
      "writtenStatement": [
        "https://ceredigion.gov.uk/media/eflarolt/ceredigion-local-development-plan-ldp-volume-1-strategy-and-policies-english.pdf",
        "https://ceredigion.gov.uk/media/xhhb3pmk/ceredigion-local-development-plan-ldp-volume-2a-settlement-group-statements-english.pdf"
      ],
      "writtenStatementCy": [
        "https://ceredigion.gov.uk/media/ztabzsau/cynllun-datblygu-lleol-cdll-ceredigion-cyfrol-1-strategaeth-a-pholis-au-cymraeg.pdf",
        "https://ceredigion.gov.uk/media/ixwofbze/cynllun-datblygu-lleol-cdll-ceredigion-cyfrol-2a-datganiadau-r-grwpiau-aneddiadau-cymraeg.pdf"
      ],
      "mapUrl": "https://ceredigion.gov.uk/media/dmubra3m/ceredigion-local-development-plan-ldp-volume-2b-proposals-maps-including-inset-maps-bilingual.pdf",
      "source": "https://ceredigion.gov.uk/resident/planning-building-control-and-sustainable-drainage-body-sab/planning-building-control/ceredigion-local-development-plan/adopted-ceredigion-local-development-plan-ldp/ ; https://ceredigion.gov.uk/preswyliwr/cynllunio-rheoli-adeiladu/cynllunio-a-rheoli-adeiladu/cynllun-datblygu-lleol/cynllun-datblygu-lleol-cdll-fabwysiadwyd/ ; https://www.ceredigion.gov.uk/media/q4ajfia5/ceredigion-ldp-2007-2022-interim-guidance-note-2025.pdf"
    },
    "replacement": {
      "title": "Replacement Ceredigion Local Development Plan (LDP2) 2018-2033",
      "periodStart": 2018,
      "periodEnd": 2033,
      "stage": "paused",
      "stageDate": "2021-10",
      "nextStage": null,
      "nextDate": null,
      "slipped": false,
      "pageUrl": "https://ceredigion.gov.uk/resident/planning-building-control-and-sustainable-drainage-body-sab/planning-building-control/ceredigion-local-development-plan/replacement-ceredigion-ldp/",
      "deposit": [],
      "source": "https://ceredigion.gov.uk/resident/planning-building-control-and-sustainable-drainage-body-sab/planning-building-control/ceredigion-local-development-plan/ ; https://www.ceredigion.gov.uk/media/zfeluu5s/2024-ceredigion-ldp-annual-monitoring-report.pdf ; https://www.ceredigion.gov.uk/resident/planning-building-control-and-sustainable-drainage-body-sab/planning-building-control/ceredigion-local-development-plan/replacement-ceredigion-ldp/deposit/ ; https://ceredigion.gov.uk/resident/planning-building-control-and-sustainable-drainage-body-sab/planning-building-control/ceredigion-local-development-plan/replacement-ceredigion-ldp/delivery-agreement"
    },
    "amr": {
      "year": "2023-24",
      "url": "https://www.ceredigion.gov.uk/media/zfeluu5s/2024-ceredigion-ldp-annual-monitoring-report.pdf",
      "source": "https://www.ceredigion.gov.uk/media/zfeluu5s/2024-ceredigion-ldp-annual-monitoring-report.pdf"
    },
    "gisUrl": null,
    "noteEn": "Work on the new plan was paused in October 2021. The council has said it will probably need to withdraw the draft prepared so far and set a new timetable.",
    "noteCy": "Cafodd y gwaith ar y cynllun newydd ei oedi ym mis Hydref 2021. Mae'r cyngor wedi dweud y bydd yn debygol o orfod tynnu'n ôl y drafft a baratowyd hyd yma a phennu amserlen newydd.",
    "checked": "2026-11-02"
  },
  {
    "id": "conwy",
    "adopted": {
      "title": "Conwy Local Development Plan 2007-2022",
      "periodStart": 2007,
      "periodEnd": 2022,
      "adoptedDate": null,
      "pageUrl": "https://www.conwy.gov.uk/en/Resident/Planning-Building-Control-and-Conservation/Placemaking-and-Strategic-Planning/Adopted-Local-Development-Plan/Adopted-Local-Development-Plan.aspx",
      "writtenStatement": [
        "https://www.conwy.gov.uk/en/Resident/Planning-Building-Control-and-Conservation/Strategic-Planning-Policy/Adopted-Local-Development-Plan-LDP/Assets-written-proposals-maps/Conwy-Local-Development-Plan-2007-2022.pdf"
      ],
      "writtenStatementCy": [],
      "mapUrl": "https://conwy.opus4.co.uk/planning/localplan/maps/ldpeng",
      "source": "https://www.conwy.gov.uk/en/Resident/Planning-Building-Control-and-Conservation/Placemaking-and-Strategic-Planning/Adopted-Local-Development-Plan/Adopted-Local-Development-Plan.aspx ; https://www.conwy.gov.uk/en/Resident/Planning-Building-Control-and-Conservation/Placemaking-and-Strategic-Planning/Adopted-Local-Development-Plan/Written-statement-and-proposals-map.aspx"
    },
    "replacement": {
      "title": "Conwy Replacement Local Development Plan 2018-2033",
      "periodStart": 2018,
      "periodEnd": 2033,
      "stage": "deposit",
      "stageDate": "2026-01",
      "nextStage": "submitted",
      "nextDate": "2026",
      "slipped": false,
      "pageUrl": "https://www.conwy.gov.uk/en/Resident/Planning-Building-Control-and-Conservation/Placemaking-and-Strategic-Planning/Replacement-Local-Development-Plan/Replacement-Local-Development-Plan.aspx",
      "deposit": [
        "https://www.conwy.gov.uk/en/Resident/Planning-Building-Control-and-Conservation/Placemaking-and-Strategic-Planning/Replacement-Local-Development-Plan/Assets/documents/Stage-6-Deposit/RLDP-Deposit-written-statement.pdf"
      ],
      "source": "https://www.conwy.gov.uk/en/Resident/Planning-Building-Control-and-Conservation/Placemaking-and-Strategic-Planning/Replacement-Local-Development-Plan/Replacement-Local-Development-Plan.aspx ; https://www.conwy.gov.uk/en/Resident/Planning-Building-Control-and-Conservation/Placemaking-and-Strategic-Planning/Replacement-Local-Development-Plan/Stage-6-Deposit-Replacement-Local-Development-Plan.aspx ; https://www.conwy.gov.uk/en/Spotlight/Press-Releases/Have-Your-Say-on-Conwy's-Deposit-Replacement-Local-Development-Plan.aspx ; https://www.conwy.gov.uk/en/Spotlight/Press-Releases/RLDP-consultation-extended-until-22-March.aspx ; https://www.conwy.gov.uk/en/Resident/Planning-Building-Control-and-Conservation/Placemaking-and-Strategic-Planning/Replacement-Local-Development-Plan/Stage-2-Delivery-agreement.aspx ; https://www.conwy.gov.uk/en/Resident/Planning-Building-Control-and-Conservation/Replacement-LDP/Stage-2-Delivery-Agreement/Conwy-DA-for-web.pdf"
    },
    "amr": {
      "year": null,
      "url": null,
      "source": null
    },
    "gisUrl": null,
    "noteEn": null,
    "noteCy": null,
    "checked": "2026-11-02"
  },
  {
    "id": "denbighshire",
    "adopted": {
      "title": "Denbighshire Local Development Plan 2006-2021",
      "periodStart": 2006,
      "periodEnd": 2021,
      "adoptedDate": null,
      "pageUrl": "https://www.sirddinbych.gov.uk/en/planning-and-building-regulations/local-development-plan/adopted-local-development-plan.aspx",
      "writtenStatement": [
        "https://www.sirddinbych.gov.uk/en/documents/planning-and-building-regulations/ldp/adopted-ldp/adopted-local-development-plan-2006-2021.pdf"
      ],
      "writtenStatementCy": [],
      "mapUrl": "https://www.sirddinbych.gov.uk/en/planning-and-building-regulations/local-development-plan/adopted-local-development-plan-map.aspx",
      "source": "https://www.sirddinbych.gov.uk/en/planning-and-building-regulations/local-development-plan/adopted-local-development-plan.aspx"
    },
    "replacement": {
      "title": "Denbighshire Replacement Local Development Plan 2018 to 2033",
      "periodStart": 2018,
      "periodEnd": 2033,
      "stage": "preferred-strategy",
      "stageDate": "2023-05",
      "nextStage": "deposit",
      "nextDate": null,
      "slipped": true,
      "pageUrl": "https://www.sirddinbych.gov.uk/en/planning-and-building-regulations/local-development-plan/replacement-local-development-plan/overview.aspx",
      "deposit": [],
      "source": "https://www.sirddinbych.gov.uk/en/planning-and-building-regulations/local-development-plan/replacement-local-development-plan/overview.aspx ; https://www.sirddinbych.gov.uk/en/planning-and-building-regulations/local-development-plan/replacement-local-development-plan/replacement-local-development-plan-update.aspx"
    },
    "amr": {
      "year": "2024-25",
      "url": "https://www.sirddinbych.gov.uk/en/documents/planning-and-building-regulations/ldp/evidence-monitoring-and-information/local-development-plan-2006-2021-annual-monitoring-report-2025.pdf",
      "source": "https://sirddinbych.gov.uk/en/planning-and-building-regulations/local-development-plan/evidence-monitoring-and-information.aspx"
    },
    "gisUrl": null,
    "noteEn": null,
    "noteCy": null,
    "checked": "2026-11-02"
  },
  {
    "id": "eryri",
    "adopted": {
      "title": "Eryri Local Development Plan 2016-2031",
      "periodStart": 2016,
      "periodEnd": 2031,
      "adoptedDate": "2019-02-06",
      "pageUrl": "https://planning.eryri.gov.wales/?p=2437",
      "writtenStatement": [
        "https://eryri.gov.wales/wp-content/uploads/2022/01/Cynllun-Datblygu-Lleol-Saesneg.pdf"
      ],
      "writtenStatementCy": [],
      "mapUrl": "https://experience.arcgis.com/experience/ba4364d4a66f45b7afb4044ff9172958/",
      "source": "https://planning.eryri.gov.wales/?p=2437; https://eryri.gov.wales/wp-content/uploads/2025/12/Annual-Monitoring-Report-2025.pdf"
    },
    "replacement": {
      "title": "Replacement Eryri Local Development Plan 2026-2041 (LDP3)",
      "periodStart": 2026,
      "periodEnd": 2041,
      "stage": "candidate-sites",
      "stageDate": "2026-02",
      "nextStage": "preferred-strategy",
      "nextDate": "2027",
      "slipped": false,
      "pageUrl": "https://planning.eryri.gov.wales/?p=7503",
      "deposit": [],
      "source": "https://planning.eryri.gov.wales/?p=7503; https://planning.eryri.gov.wales/?p=7654; https://eryri.gov.wales/wp-content/uploads/2025/05/Delivery-Agreement.pdf; https://eryri.gov.wales/wp-content/uploads/2025/11/Welsh-Government-Letter.pdf; https://eryri.gov.wales/?p=43302; https://eryri.oc2.uk/document/1"
    },
    "amr": {
      "year": "2024-25",
      "url": "https://eryri.gov.wales/wp-content/uploads/2025/12/Annual-Monitoring-Report-2025.pdf",
      "source": "https://eryri.gov.wales/wp-content/uploads/2025/12/Annual-Monitoring-Report-2025.pdf"
    },
    "gisUrl": "https://experience.arcgis.com/experience/ba4364d4a66f45b7afb4044ff9172958/",
    "noteEn": null,
    "noteCy": null,
    "checked": "2026-11-02"
  },
  {
    "id": "flintshire",
    "adopted": {
      "title": "Flintshire Local Development Plan 2015-2030",
      "periodStart": 2015,
      "periodEnd": 2030,
      "adoptedDate": "2023-01-24",
      "pageUrl": "https://www.flintshire.gov.uk/en/Resident/Planning/Local-Development-Plan.aspx",
      "writtenStatement": [
        "https://www.flintshire.gov.uk/en/PDFFiles/Planning/Examination-Library-Documents/FINAL-LDP-Written-Statement-English.pdf"
      ],
      "writtenStatementCy": [
        "https://www.siryfflint.gov.uk/cy/PDFFiles/Planning/Examination-Library-Documents/FINAL-LDP-Written-Statement-Welsh.pdf"
      ],
      "mapUrl": "https://flintshire.opus4.co.uk/planning/localplan/maps/flintshireproposals",
      "source": "https://www.flintshire.gov.uk/en/Resident/Planning/Local-Development-Plan.aspx"
    },
    "replacement": {
      "title": null,
      "periodStart": null,
      "periodEnd": null,
      "stage": "none",
      "stageDate": null,
      "nextStage": null,
      "nextDate": null,
      "slipped": false,
      "pageUrl": null,
      "deposit": [],
      "source": "https://www.flintshire.gov.uk/en/PDFFiles/Planning/PolicyMisc/Annual-Monitoring-Report-AMR2.pdf"
    },
    "amr": {
      "year": "2024-25",
      "url": "https://www.flintshire.gov.uk/en/PDFFiles/Planning/PolicyMisc/Annual-Monitoring-Report-AMR2.pdf",
      "source": "https://www.flintshire.gov.uk/en/Resident/Planning/Monitoring.aspx ; https://www.flintshire.gov.uk/en/PDFFiles/Planning/PolicyMisc/Annual-Monitoring-Report-AMR2.pdf"
    },
    "gisUrl": null,
    "noteEn": "The plan must be reviewed by January 2027. The council expected to consult on a review report in late 2026.",
    "noteCy": "Rhaid adolygu'r cynllun erbyn mis Ionawr 2027. Roedd y cyngor yn disgwyl ymgynghori ar adroddiad adolygu ddiwedd 2026.",
    "checked": "2026-11-02"
  },
  {
    "id": "gwynedd",
    "adopted": {
      "title": "Anglesey and Gwynedd Joint Local Development Plan 2011 - 2026",
      "periodStart": 2011,
      "periodEnd": 2026,
      "adoptedDate": "2017-07-31",
      "pageUrl": "https://www.gwynedd.llyw.cymru/en/Council/Strategies-and-policies/Environment-and-planning/Planning-policy/Joint-Local-Development-Plan/Joint-Local-Development-Plan-Current/Joint-Local-Development-Plan.aspx",
      "writtenStatement": [
        "https://www.gwynedd.llyw.cymru/en/Council/Documents---Council/Strategies-and-policies/Environment-and-planning/Planning-policy/Anglesey-and-Gwynedd-Joint-Local-Development-Plan-Written-Statement.pdf"
      ],
      "writtenStatementCy": [
        "https://www.gwynedd.llyw.cymru/cy/Cyngor/Dogfennau-Cyngor/Strategaethau-a-pholisiau/Cynllunio-ac-amgylchedd/Polisi-cynllunio/Cynllun-Datblygu-Lleol-ar-y-Cyd-Gwynedd-a-M%C3%B4n-Datganiad-Ysgrifenedig.pdf"
      ],
      "mapUrl": "https://www.gwynedd.llyw.cymru/en/Council/Strategies-and-policies/Environment-and-planning/Planning-policy/Joint-Local-Development-Plan/Joint-Local-Development-Plan-Current/Proposals-maps.aspx",
      "source": "https://www.gwynedd.llyw.cymru/en/Council/Strategies-and-policies/Environment-and-planning/Planning-policy/Joint-Local-Development-Plan/Joint-Local-Development-Plan-Current/Joint-Local-Development-Plan.aspx ; https://www.gwynedd.llyw.cymru/en/Council/Documents---Council/Strategies-and-policies/Environment-and-planning/Planning-policy/Anglesey-and-Gwynedd-Joint-Local-Development-Plan-Written-Statement.pdf"
    },
    "replacement": {
      "title": "Gwynedd Local Development Plan 2024-2039",
      "periodStart": 2024,
      "periodEnd": 2039,
      "stage": "candidate-sites",
      "stageDate": null,
      "nextStage": "preferred-strategy",
      "nextDate": null,
      "slipped": true,
      "pageUrl": "https://www.gwynedd.llyw.cymru/en/Council/Strategies-and-policies/Environment-and-planning/Planning-policy/Joint-Local-Development-Plan/Cynllun-Datblygu-Lleol-ar-y-Cyd-diwygiedig/Gwynedd-Local-Development-Plan-the-new-Plan.aspx",
      "deposit": [],
      "source": "https://www.gwynedd.llyw.cymru/en/Council/Strategies-and-policies/Environment-and-planning/Planning-policy/Joint-Local-Development-Plan/Cynllun-Datblygu-Lleol-ar-y-Cyd-diwygiedig/Gwynedd-Local-Development-Plan-the-new-Plan.aspx ; https://www.gwynedd.llyw.cymru/en/Council/Documents---Council/Strategies-and-policies/Environment-and-planning/Gwynedd-LDP-Delivery-Agreement-2024.pdf ; https://www.gwynedd.llyw.cymru/en-gb/have-your-say/recent-consultations-and-surveys/consultations-and-surveys-2026/gwynedd-local-development-plan-survey ; https://democracy.gwynedd.llyw.cymru/documents/s46306/Appendix 1.pdf"
    },
    "amr": {
      "year": "2024-25",
      "url": "https://www.gwynedd.llyw.cymru/en/Council/Documents---Council/Strategies-and-policies/Environment-and-planning/Planning-policy/Annual-Montoring-Report/Fersiwn-Gwefan-AMB-7-Saesneg.pdf",
      "source": "https://www.gwynedd.llyw.cymru/en/Council/Strategies-and-policies/Environment-and-planning/Planning-policy/Joint-Local-Development-Plan/Joint-Local-Development-Plan-Current/Joint-Local-Development-Plan.aspx"
    },
    "gisUrl": "https://cyngorgwynedd.maps.arcgis.com/apps/webappviewer/index.html?id=433486dc14824d5c80a7f06e2dd57150",
    "noteEn": "Anglesey and Gwynedd share one joint plan, which covers Gwynedd outside Eryri National Park. The figures and sites below cover both areas. Each council is now writing its own replacement.",
    "noteCy": "Mae Gwynedd ac Ynys Môn yn rhannu un cynllun ar y cyd, sy'n cwmpasu Gwynedd y tu allan i Barc Cenedlaethol Eryri. Mae'r ffigurau a'r safleoedd isod yn cwmpasu'r ddwy ardal. Mae pob cyngor bellach yn ysgrifennu ei gynllun newydd ei hun.",
    "checked": "2026-11-02"
  },
  {
    "id": "merthyr-tydfil",
    "adopted": {
      "title": "Merthyr Tydfil Replacement Local Development Plan 2016-2031",
      "periodStart": 2016,
      "periodEnd": 2031,
      "adoptedDate": "2020-01-29",
      "pageUrl": "https://www.merthyr.gov.uk/resident/planning-and-building-control/first-replacement-local-development-plan-2016-2031",
      "writtenStatement": [
        "https://www.merthyr.gov.uk/media/6710/replacement-ldp-written-statement-final-composite-version-290120-type-set-from-donna-nrl.pdf"
      ],
      "writtenStatementCy": [],
      "mapUrl": "https://www.merthyr.gov.uk/media/5638/adopted-replacement-ldp-2016-2031-proposals-map-january-2020.pdf",
      "source": "https://www.merthyr.gov.uk/resident/planning-and-building-control/first-replacement-local-development-plan-2016-2031; https://www.merthyr.gov.uk/resident/planning-and-building-control/planning-policy/"
    },
    "replacement": {
      "title": "Merthyr Tydfil Second Replacement Local Development Plan 2026-2041",
      "periodStart": 2026,
      "periodEnd": 2041,
      "stage": "candidate-sites",
      "stageDate": "2026-09",
      "nextStage": "preferred-strategy",
      "nextDate": "2027",
      "slipped": false,
      "pageUrl": "https://www.merthyr.gov.uk/resident/planning-and-building-control/second-replacement-local-development-plan-2026-2041/",
      "deposit": [],
      "source": "https://www.merthyr.gov.uk/resident/planning-and-building-control/second-replacement-local-development-plan-2026-2041/; https://www.merthyr.gov.uk/resident/planning-and-building-control/second-replacement-local-development-plan-2026-2041/candidate-sites/; https://www.merthyr.gov.uk/media/11608/delivery-agreement.pdf"
    },
    "amr": {
      "year": "2024-25",
      "url": "https://www.merthyr.gov.uk/media/11100/fifth-annual-monitoring-report-october-2025.pdf",
      "source": "https://www.merthyr.gov.uk/media/11100/fifth-annual-monitoring-report-october-2025.pdf; https://www.merthyr.gov.uk/resident/planning-and-building-control/planning-policy/"
    },
    "gisUrl": "https://mtcbc.maps.arcgis.com/apps/instant/sidebar/index.html?appid=f04b6084aa8248979c39bc9bcb80f424",
    "noteEn": null,
    "noteCy": null,
    "checked": "2026-11-02"
  },
  {
    "id": "monmouthshire",
    "adopted": {
      "title": "Monmouthshire Local Development Plan 2011-2021",
      "periodStart": 2011,
      "periodEnd": 2021,
      "adoptedDate": "2014-02-27",
      "pageUrl": "https://www.monmouthshire.gov.uk/planning-policy/monmouthshire-local-development-plan",
      "writtenStatement": [
        "http://www.monmouthshire.gov.uk/app/uploads/2017/05/Adopted-Local-Development-Plan-with-PDF-tags.pdf"
      ],
      "writtenStatementCy": [],
      "mapUrl": "https://www.monmouthshire.gov.uk/planning-policy/local-development-plan-2011-2021/interactive-local-development-plan-mapping/",
      "source": "https://www.monmouthshire.gov.uk/planning-policy/monmouthshire-local-development-plan"
    },
    "replacement": {
      "title": "Monmouthshire Replacement Local Development Plan 2018-2033",
      "periodStart": 2018,
      "periodEnd": 2033,
      "stage": "examination",
      "stageDate": "2025-11",
      "nextStage": "adopted",
      "nextDate": null,
      "slipped": false,
      "pageUrl": "https://www.monmouthshire.gov.uk/planning-policy/local-development-plan-revision/rldp-submission/",
      "deposit": [
        "https://www.monmouthshire.gov.uk/app/uploads/2025/10/SD9-Monmouthshire-Deposit-RLDP-as-amended-with-track-changes-October-2025.pdf"
      ],
      "source": "https://www.monmouthshire.gov.uk/planning-policy/local-development-plan-revision/rldp-submission/; https://www.hwa.uk.com/?p=29903; https://www.hwa.uk.com/site/wp-content/uploads/2025/10/MCC-time-table.pdf; https://www.monmouthshire.gov.uk/planning-policy/plan-preparation/deposit-plan"
    },
    "amr": {
      "year": "2022-23",
      "url": "https://www.monmouthshire.gov.uk/app/uploads/2024/02/AMR-2022-2023-combined-report.pdf",
      "source": "https://www.monmouthshire.gov.uk/planning-policy/annual-monitoring/ldp-annual-monitoring-report"
    },
    "gisUrl": null,
    "noteEn": "Public hearings on the new plan were held in September and October 2026. The inspectors expect to send their report to the council for checking in March 2027.",
    "noteCy": "Cynhaliwyd gwrandawiadau cyhoeddus ar y cynllun newydd ym mis Medi a mis Hydref 2026. Mae'r arolygwyr yn disgwyl anfon eu hadroddiad at y cyngor i'w wirio ym mis Mawrth 2027.",
    "checked": "2026-11-02"
  },
  {
    "id": "neath-port-talbot",
    "adopted": {
      "title": "Neath Port Talbot County Borough Council Local Development Plan (2011-2026)",
      "periodStart": 2011,
      "periodEnd": 2026,
      "adoptedDate": "2016-01-27",
      "pageUrl": "https://www.npt.gov.uk/planning-and-building-control/planning-policy/adopted-ldp-2011-2026",
      "writtenStatement": [
        "https://media.npt.gov.uk/media/ca2fbumd/ldp_written_statement_jan16.pdf"
      ],
      "writtenStatementCy": [
        "https://www.npt.gov.uk/media/7325/ldp_written_statement_jan16_cym.pdf"
      ],
      "mapUrl": "https://media.npt.gov.uk/media/3w4nglu3/ldp_proposals_map_jan16.pdf",
      "source": "https://www.npt.gov.uk/planning-and-building-control/planning-policy/adopted-ldp-2011-2026; https://media.npt.gov.uk/media/ca2fbumd/ldp_written_statement_jan16.pdf; https://www.npt.gov.uk/media/7325/ldp_written_statement_jan16_cym.pdf"
    },
    "replacement": {
      "title": "Neath Port Talbot Replacement Local Development Plan (RLDP) 2023-2038",
      "periodStart": 2023,
      "periodEnd": 2038,
      "stage": "preferred-strategy",
      "stageDate": "2024-12",
      "nextStage": "deposit",
      "nextDate": null,
      "slipped": true,
      "pageUrl": "https://www.npt.gov.uk/planning-and-building-control/planning-policy/replacement-local-development-plan-rldp-2023-2038/",
      "deposit": [],
      "source": "https://www.npt.gov.uk/planning-and-building-control/planning-policy/replacement-local-development-plan-rldp-2023-2038/preferred-strategy/; https://www.npt.gov.uk/planning-and-building-control/planning-policy/replacement-local-development-plan-rldp-2023-2038/latest-news/; https://www.npt.gov.uk/planning-and-building-control/planning-policy/replacement-local-development-plan-rldp-2023-2038/deposit-plan/; https://www.npt.gov.uk/planning-and-building-control/planning-policy/replacement-local-development-plan-rldp-2023-2038/delivery-agreement/"
    },
    "amr": {
      "year": "2022-23",
      "url": "https://media.npt.gov.uk/media/zmgoz114/neath-port-talbot-local-development-plan-annual-monitoring-report-amr-2023.pdf",
      "source": "https://www.npt.gov.uk/planning-and-building-control/planning-policy/ldp-annual-monitoring"
    },
    "gisUrl": null,
    "noteEn": null,
    "noteCy": null,
    "checked": "2026-11-02"
  },
  {
    "id": "newport",
    "adopted": {
      "title": "Newport Local Development Plan 2011-2026",
      "periodStart": 2011,
      "periodEnd": 2026,
      "adoptedDate": "2015-01-27",
      "pageUrl": "https://www.newport.gov.uk/planning/planning-policy/local-development-plan/local-development-plan-adoption",
      "writtenStatement": [
        "https://www.newport.gov.uk/sites/default/files/media/media-documents/Adopted%20Local%20Development%20Plan%202011-2026.pdf"
      ],
      "writtenStatementCy": [],
      "mapUrl": null,
      "source": "https://www.newport.gov.uk/planning/planning-policy/local-development-plan/local-development-plan-adoption; https://www.newport.gov.uk/planning/planning-policy/replacement-local-development-plan"
    },
    "replacement": {
      "title": "Newport Replacement Local Development Plan 2021-2036",
      "periodStart": 2021,
      "periodEnd": 2036,
      "stage": "deposit",
      "stageDate": "2026-10",
      "nextStage": "submitted",
      "nextDate": null,
      "slipped": false,
      "pageUrl": "https://newportrldp.co.uk/",
      "deposit": [],
      "source": "https://newportrldp.co.uk/; https://www.newport.gov.uk/planning/planning-policy/replacement-local-development-plan; https://www.newport.gov.uk/planning/planning-policy/replacement-local-development-plan/preferred-strategy-pre-deposit-plan"
    },
    "amr": {
      "year": null,
      "url": "https://www.newport.gov.uk/sites/default/files/media/media-documents/LDP%20annual%20monitoring%20report%202024.pdf",
      "source": "https://www.newport.gov.uk/planning/planning-policy/local-development-plan/monitoring-reports"
    },
    "gisUrl": null,
    "noteEn": "Consultation on the draft new plan runs until 21 December 2026.",
    "noteCy": "Mae'r ymgynghoriad ar y cynllun newydd drafft yn para tan 21 Rhagfyr 2026.",
    "checked": "2026-11-02"
  },
  {
    "id": "pembrokeshire",
    "adopted": {
      "title": "Pembrokeshire County Council Local Development Plan (up to 2021)",
      "periodStart": null,
      "periodEnd": 2021,
      "adoptedDate": "2013-02-28",
      "pageUrl": "https://cms.pembrokeshire.gov.uk/adopted-local-development-plan",
      "writtenStatement": [
        "https://www.pembrokeshire.gov.uk/objview.asp?object_id=3398&language="
      ],
      "writtenStatementCy": [],
      "mapUrl": "https://cms.pembrokeshire.gov.uk/adopted-local-development-plan",
      "source": "https://cms.pembrokeshire.gov.uk/adopted-local-development-plan ; https://cms.pembrokeshire.gov.uk/local-development-plan-review/submission"
    },
    "replacement": {
      "title": "Pembrokeshire Local Development Plan 2 (LDP2)",
      "periodStart": 2017,
      "periodEnd": 2033,
      "stage": "examination",
      "stageDate": "2025-10",
      "nextStage": "adopted",
      "nextDate": null,
      "slipped": true,
      "pageUrl": "https://www.pembrokeshire.gov.uk/local-development-plan-review",
      "deposit": [
        "https://cms.pembrokeshire.gov.uk/objview.asp?object_id=11615&language="
      ],
      "source": "https://www.pembrokeshire.gov.uk/local-development-plan-review/examination-2025 ; https://cms.pembrokeshire.gov.uk/local-development-plan-review/submission ; https://cms.pembrokeshire.gov.uk/local-development-plan-review/deposit ; https://newsroom.pembrokeshire.gov.uk/news/examination-hearings-for-pembrokeshires-local-development-plan-2-to-begin-in-november ; https://newsroom.pembrokeshire.gov.uk/news/plan-overseeing-development-in-pembrokeshire-needs-public-views-before-completion ; https://cms.pembrokeshire.gov.uk/local-development-plan-review/delivery-agreement-including-the-community-involvement-scheme"
    },
    "amr": {
      "year": "2024-25",
      "url": "https://www.pembrokeshire.gov.uk/objview.asp?object_id=12321&language=",
      "source": "https://www.pembrokeshire.gov.uk/adoptedlocal-development-plan/implementation-and-monitoring"
    },
    "gisUrl": null,
    "noteEn": "The plan in force covers the county outside the national park and stays in force until the new plan is adopted. Public hearings on the new plan are being held in November and December 2026.",
    "noteCy": "Mae'r cynllun mewn grym yn cwmpasu'r sir y tu allan i'r parc cenedlaethol ac mae'n parhau mewn grym nes i'r cynllun newydd gael ei fabwysiadu. Cynhelir gwrandawiadau cyhoeddus ar y cynllun newydd ym mis Tachwedd a mis Rhagfyr 2026.",
    "checked": "2026-11-02"
  },
  {
    "id": "pembrokeshire-coast",
    "adopted": {
      "title": "Pembrokeshire Coast National Park Local Development Plan 2 (2015-2031)",
      "periodStart": 2015,
      "periodEnd": 2031,
      "adoptedDate": "2020-09-30",
      "pageUrl": "https://www.pembrokeshirecoast.wales/planning/planning-policy/local-development-plan-2/",
      "writtenStatement": [
        "https://www.pembrokeshirecoast.wales/wp-content/uploads/2026/02/LDP-Text-for-Adoption-Web.pdf"
      ],
      "writtenStatementCy": [],
      "mapUrl": "https://pcnpa.maps.arcgis.com/apps/webappviewer/index.html?id=df0b56ecca73455c8830d3ac2b5166f3",
      "source": "https://www.pembrokeshirecoast.wales/planning/planning-policy/local-development-plan-2/; https://www.pembrokeshirecoast.wales/wp-content/uploads/2020/08/Appendix-C-LDP-Adoption-Statement.pdf; https://www.pembrokeshirecoast.wales/wp-content/uploads/2020/05/2020-05-13-PCNPA-RLDP-Inspectors-Report-Eng.pdf"
    },
    "replacement": {
      "title": "Replacement Pembrokeshire Coast National Park Authority Local Development Plan 3: 2025 to 2040",
      "periodStart": 2025,
      "periodEnd": 2040,
      "stage": "candidate-sites",
      "stageDate": "2026-01",
      "nextStage": "preferred-strategy",
      "nextDate": "2027",
      "slipped": false,
      "pageUrl": "https://www.pembrokeshirecoast.wales/planning/planning-policy/local-development-plan-3/",
      "deposit": [],
      "source": "https://www.pembrokeshirecoast.wales/planning/planning-policy/local-development-plan-3/; https://www.pembrokeshirecoast.wales/wp-content/uploads/2026/01/LDP-3-DA-v2-December-2025.pdf; https://www.pembrokeshirecoast.wales/news/have-your-say-on-the-future-of-the-pembrokeshire-coast-national-park-2/; https://www.pembrokeshirecoast.wales/call-for-candidate-sites-ldp-3/"
    },
    "amr": {
      "year": "2024-25",
      "url": "https://www.pembrokeshirecoast.wales/wp-content/uploads/2026/01/4th-LDP2-AMR-1-2.pdf",
      "source": "https://www.pembrokeshirecoast.wales/planning/planning-policy/local-development-plan-2/annual-monitoring-reports/"
    },
    "gisUrl": "https://pcnpa.maps.arcgis.com/apps/webappviewer/index.html?id=df0b56ecca73455c8830d3ac2b5166f3",
    "noteEn": null,
    "noteCy": null,
    "checked": "2026-11-02"
  },
  {
    "id": "powys",
    "adopted": {
      "title": "Powys Local Development Plan (2011-2026)",
      "periodStart": 2011,
      "periodEnd": 2026,
      "adoptedDate": "2018-04-17",
      "pageUrl": "https://en.powys.gov.uk/article/4898/Adopted-LDP-2011---2026",
      "writtenStatement": [
        "https://en.powys.gov.uk/media/4256/Adopted-Powys-LDP-Written-Statement-April-2018/pdf/saAdopted_Powys_LDP_Written_Statement_April_2018.pdf"
      ],
      "writtenStatementCy": [],
      "mapUrl": null,
      "source": "https://english.powys1-prd.gosshosted.com/article/4898/Adopted-LDP-2011---2026 (mirror of the council page, which blocked fetching)"
    },
    "replacement": {
      "title": "Powys Replacement Local Development Plan (2022-2037)",
      "periodStart": 2022,
      "periodEnd": 2037,
      "stage": "preferred-strategy",
      "stageDate": "2024-08",
      "nextStage": "deposit",
      "nextDate": null,
      "slipped": true,
      "pageUrl": "https://en.powys.gov.uk/article/12866/Replacement-Local-Development-Plan-2022---2037",
      "deposit": [],
      "source": "https://en.powys.gov.uk/article/13151/Replacement-LDP-Review-Report-and-Delivery-Agreement?ccp=true ; https://ldp.powys.gov.uk/ ; https://ldp.powys.gov.uk/document/35 ; https://powys.oc2.uk/docfiles/36/Powys RLDP Delivery Agreement July 24 eng_final.pdf ; https://powys.moderngov.co.uk/mgConvert2PDF.aspx?ID=105719 ; https://en.powys.gov.uk/article/4931/Latest-Planning-Policy-News?ccp=true"
    },
    "amr": {
      "year": null,
      "url": "https://en.powys.gov.uk/media/27496/Annual-Monitoring-Report-2026/pdf/s0Annual_Monitoring_Report_2026.pdf",
      "source": "https://en.powys.gov.uk/article/4910/Annual-Monitoring-Report"
    },
    "gisUrl": "https://www.data.gov.uk/dataset/99597658-aaa4-426b-8b67-f98e198712a2/pcc-ldp-resalloc",
    "noteEn": null,
    "noteCy": null,
    "checked": "2026-11-02"
  },
  {
    "id": "rhondda-cynon-taf",
    "adopted": {
      "title": "Rhondda Cynon Taf Local Development Plan 2006-2021",
      "periodStart": 2006,
      "periodEnd": 2021,
      "adoptedDate": "2011-03-02",
      "pageUrl": "https://www.rctcbc.gov.uk/EN/Resident/PlanningandBuildingControl/LocalDevelopmentPlans/LocalDevelopmentPlan20062021.aspx",
      "writtenStatement": [
        "https://www.rctcbc.gov.uk/EN/Resident/PlanningandBuildingControl/LocalDevelopmentPlans/RelateddocumentsLDP20062021/AdoptedLocalDevelopmentPlan.pdf"
      ],
      "writtenStatementCy": [],
      "mapUrl": "http://www.cartogold.co.uk/rhondda/",
      "source": "https://www.rctcbc.gov.uk/EN/Resident/PlanningandBuildingControl/LocalDevelopmentPlans/WhatistheLocalDevelopmentPlan.aspx; https://www.rctcbc.gov.uk/EN/Resident/PlanningandBuildingControl/LocalDevelopmentPlans/LocalDevelopmentPlan20062021.aspx"
    },
    "replacement": {
      "title": "Rhondda Cynon Taf Revised Local Development Plan 2022-2037",
      "periodStart": 2022,
      "periodEnd": 2037,
      "stage": "preferred-strategy",
      "stageDate": "2024-02",
      "nextStage": "deposit",
      "nextDate": null,
      "slipped": true,
      "pageUrl": "https://www.rctcbc.gov.uk/EN/Resident/PlanningandBuildingControl/RevisedLocalDevelopmentPlan20222037/RevisedLocalDevelopmentPlanLDP2022%E2%80%932037.aspx",
      "deposit": [],
      "source": "https://www.rctcbc.gov.uk/EN/Resident/PlanningandBuildingControl/RevisedLocalDevelopmentPlan20222037/PreferredStrategyConsultation.aspx; https://www.rctcbc.gov.uk/EN/Resident/PlanningandBuildingControl/RevisedLocalDevelopmentPlan20222037/RevisedLDPDeliveryAgreement.aspx; https://rctcbc.moderngov.co.uk/documents/s41881/Report.pdf?LLL=-1; https://www.rctcbc.gov.uk/EN/Newsroom/PressReleases/2024/October/CabinetprogressesRevisedLDPwithrefinedPreferredStrategy.aspx"
    },
    "amr": {
      "year": "2020-21",
      "url": "https://www.rctcbc.gov.uk/CY/Council/CouncillorsCommitteesandMeetings/DelegatedDecisions/RelatedDocuments/Decisions/2021to2022/RhonddaCynonTafLocalDevelopmentPlanAnnualMonitoringReports2020and2021.pdf",
      "source": "https://www.rctcbc.gov.uk/CY/Council/CouncillorsCommitteesandMeetings/DelegatedDecisions/RelatedDocuments/Decisions/2021to2022/RhonddaCynonTafLocalDevelopmentPlanAnnualMonitoringReports2020and2021.pdf; https://www.rctcbc.gov.uk/EN/Resident/PlanningandBuildingControl/LocalDevelopmentPlans/LDPEvidenceBaseLibraryandAnnualMonitoringRe/AnnualMonitoringReport.aspx"
    },
    "gisUrl": null,
    "noteEn": "The latest annual monitoring report we could find covers 2020-21.",
    "noteCy": "Mae'r adroddiad monitro blynyddol diweddaraf y gallwn ddod o hyd iddo yn ymdrin â 2020-21.",
    "checked": "2026-11-02"
  },
  {
    "id": "swansea",
    "adopted": {
      "title": "Swansea Local Development Plan 2010-2025",
      "periodStart": 2010,
      "periodEnd": 2025,
      "adoptedDate": "2019-02-28",
      "pageUrl": "https://swansea.gov.uk/ldp",
      "writtenStatement": [
        "https://swansea.gov.uk/media/9367/SWANSEA_LDP_2010-2025_ENG_WEB/pdf/4jSWANSEA_LDP_2010-2025_ENG_WEB.pdf"
      ],
      "writtenStatementCy": [],
      "mapUrl": null,
      "source": "https://swansea.gov.uk/ldp; https://swansea.gov.uk/ldppreparationandevidence"
    },
    "replacement": {
      "title": "Swansea Local Development Plan 2023-2038 (LDP2)",
      "periodStart": 2023,
      "periodEnd": 2038,
      "stage": "preferred-strategy",
      "stageDate": "2025-02",
      "nextStage": "deposit",
      "nextDate": "2026",
      "slipped": false,
      "pageUrl": "https://www.swansea.gov.uk/LDP2",
      "deposit": [],
      "source": "https://swansea.gov.uk/ldppreferredstrategy; https://www.swansea.gov.uk/ldp2deliveryagreement; https://swansea.oc2.uk/docfiles/45/Swansea_LDP2_Revised_Delivery_Agreement_February_2025.pdf; https://swansea.oc2.uk"
    },
    "amr": {
      "year": "2024-25",
      "url": "https://democracy.swansea.gov.uk/mgConvert2PDF.aspx?ID=113024",
      "source": "https://www.swansea.gov.uk/planningdelivery"
    },
    "gisUrl": null,
    "noteEn": null,
    "noteCy": null,
    "checked": "2026-11-02"
  },
  {
    "id": "torfaen",
    "adopted": {
      "title": "Torfaen Local Development Plan (to 2021)",
      "periodStart": 2006,
      "periodEnd": 2021,
      "adoptedDate": "2013-12-03",
      "pageUrl": "https://www.torfaen.gov.uk/en/planning-and-building/planning-policy/local-development-plan",
      "writtenStatement": [
        "https://www.torfaen.gov.uk/asset-library/en/planning-policy/adopted-torfaen-ldp-writen-statement.pdf"
      ],
      "writtenStatementCy": [],
      "mapUrl": "https://www.torfaen.gov.uk/asset-library/en/planning-policy/p3-torfaen-prop-map-north-14.pdf",
      "source": "https://www.torfaen.gov.uk/en/planning-and-building/planning-policy/local-development-plan; https://www.torfaen.gov.uk/asset-library/en/planning-policy/adopted-torfaen-ldp-writen-statement.pdf; https://www.torfaen.gov.uk/en/Related-Documents/Forward-Planning/Notice-of-Adoption---11-Dec-2013.pdf"
    },
    "replacement": {
      "title": "Blaenau Gwent and Torfaen Joint Local Development Plan (JLDP)",
      "periodStart": 2026,
      "periodEnd": 2041,
      "stage": "delivery-agreement",
      "stageDate": "2026-07",
      "nextStage": "candidate-sites",
      "nextDate": "2027",
      "slipped": false,
      "pageUrl": "https://www.bgtjointldp.org.uk/",
      "deposit": [],
      "source": "https://www.torfaen.gov.uk/en/planning-and-building/planning-policy/replacement-local-development-plan; https://www.torfaen.gov.uk/en/news/joint-local-development-plan-agreed; https://www.torfaen.gov.uk/en/news/draft-timetable-for-joint-local-development-plan-agreed; https://torfaen.moderngov.co.uk/documents/s78524/Council Report on Draft JLDP Delivery Agreement - final.pdf"
    },
    "amr": {
      "year": "2025-26",
      "url": "https://www.torfaen.gov.uk/asset-library/en/planning-policy/LDP-Annual-Monitoring-Report.pdf",
      "source": "https://www.torfaen.gov.uk/asset-library/en/planning-policy/LDP-Annual-Monitoring-Report.pdf; https://www.torfaen.gov.uk/en/planning-and-building/planning-policy/local-development-plan"
    },
    "gisUrl": null,
    "noteEn": "Torfaen withdrew its own new plan in March 2026 and is writing a joint plan with Blaenau Gwent.",
    "noteCy": "Tynnodd Torfaen ei gynllun newydd ei hun yn ôl ym mis Mawrth 2026 ac mae'n ysgrifennu cynllun ar y cyd â Blaenau Gwent.",
    "checked": "2026-11-02"
  },
  {
    "id": "vale-of-glamorgan",
    "adopted": {
      "title": "Vale of Glamorgan Local Development Plan 2011-2026",
      "periodStart": 2011,
      "periodEnd": 2026,
      "adoptedDate": "2017-06-28",
      "pageUrl": "https://www.valeofglamorgan.gov.uk/en/living/planning_and_building_control/Planning/planning_policy",
      "writtenStatement": [
        "https://www.valeofglamorgan.gov.uk/Documents/Living/Planning/Policy/LDP/LDP-Adoption/Adopted-LDP-Written-Statement-June-2017-final-interactive-web-version.pdf"
      ],
      "writtenStatementCy": [
        "https://valeofglamorgan.gov.uk/Documents/Living/Planning/Policy/LDP/LDP-Written-Statement-June-2017-Welsh-Version.pdf"
      ],
      "mapUrl": "https://www.valeofglamorgan.gov.uk/Documents/Living/Planning/Policy/LDP/LDP-Adoption/Adopted-LDP-Proposals-Map.pdf",
      "source": "https://www.valeofglamorgan.gov.uk/en/living/planning_and_building_control/Planning/planning_policy; https://valeofglamorgan.gov.uk/Documents/Living/Planning/Policy/LDP/LDP-Adoption/Adopted-LDP-Written-Statement-June-2017-final-interactive-web-version.pdf"
    },
    "replacement": {
      "title": "Vale of Glamorgan Replacement Local Development Plan 2021-2036",
      "periodStart": 2021,
      "periodEnd": 2036,
      "stage": "deposit",
      "stageDate": "2026-01",
      "nextStage": "submitted",
      "nextDate": "2026",
      "slipped": false,
      "pageUrl": "https://www.valeofglamorgan.gov.uk/en/living/planning_and_building_control/Planning/planning_policy/RLDP/Replacement-Local-Development-Plan.aspx",
      "deposit": [
        "https://valeofglamorgan.oc2.uk/docfiles/63/Deposit%20Plan_1.pdf"
      ],
      "source": "https://www.valeofglamorgan.gov.uk/en/living/planning_and_building_control/Planning/planning_policy/RLDP/Replacement-Local-Development-Plan.aspx; https://www.valeofglamorgan.gov.uk/en/living/planning_and_building_control/Planning/planning_policy/RLDP/Overview-and-Timescale.aspx; https://valeofglamorgan.oc2.uk/document/58; https://www.valeofglamorgan.gov.uk/Documents/_Committee%20Reports/Council/2026/26-01-12-6.45pm/Ref-to-Place-from-Cab-Deposit-RLDP-Revised.pdf"
    },
    "amr": {
      "year": "2025-26",
      "url": "https://www.valeofglamorgan.gov.uk/Documents/Living/Planning/Policy/LDP/Annual-Monitoring-Report-2025-26.pdf",
      "source": "https://www.valeofglamorgan.gov.uk/en/living/planning_and_building_control/Planning/planning_policy"
    },
    "gisUrl": null,
    "noteEn": null,
    "noteCy": null,
    "checked": "2026-11-02"
  },
  {
    "id": "wrexham",
    "adopted": {
      "title": "Wrexham Unitary Development Plan 1996-2011",
      "periodStart": 1996,
      "periodEnd": 2011,
      "adoptedDate": null,
      "pageUrl": "https://wrexham.gov.uk/service/planning-application-guidance/development-plans-and-other-planning-policy",
      "writtenStatement": [],
      "writtenStatementCy": [],
      "mapUrl": null,
      "source": "https://wrexham.gov.uk/service/planning-application-guidance/development-plans-and-other-planning-policy ; https://www.llyw.cymru/sites/default/files/publications/2026-08/atisn26856doc1_0.pdf (PEDW advice note released by Welsh Government under FOI 26856: 'Wrexham Unitary Development Plan 1996-2011, adopted 2005')"
    },
    "replacement": {
      "title": null,
      "periodStart": null,
      "periodEnd": null,
      "stage": "none",
      "stageDate": null,
      "nextStage": null,
      "nextDate": null,
      "slipped": false,
      "pageUrl": null,
      "deposit": [],
      "source": "https://wrexham.gov.uk/service/planning-application-guidance/development-plans-and-other-planning-policy ; https://www.gov.wales/atisn26856"
    },
    "amr": {
      "year": null,
      "url": null,
      "source": null
    },
    "gisUrl": null,
    "noteEn": "Wrexham has no local development plan. Its plan adopted in 2023 was quashed by the High Court in 2025 and withdrawn in 2026, so the old Unitary Development Plan and the Welsh Government's national plan, Future Wales, apply instead.",
    "noteCy": "Nid oes gan Wrecsam gynllun datblygu lleol. Cafodd ei gynllun a fabwysiadwyd yn 2023 ei ddiddymu gan yr Uchel Lys yn 2025 a'i dynnu'n ôl yn 2026, felly mae'r hen Gynllun Datblygu Unedol a chynllun cenedlaethol Llywodraeth Cymru, Cymru'r Dyfodol, yn berthnasol yn lle hynny.",
    "checked": "2026-11-02"
  },
];

export const ldpFor = (id: string) => LDPS.find((l) => l.id === id);
