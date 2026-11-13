/**
 * Strings shared across the whole site: header, footer and the small
 * vocabulary that appears on many pages. Feature pages keep their own
 * strings next to this file.
 */
import { defineMessages } from "../server";

export const common = defineMessages({
  en: {
    siteName: "OpenCouncils",
    description:
      "Every council in the UK in one place: who runs it, what it is deciding and what the watchdogs say. Independent and free to use.",
    skipToContent: "Skip to content",
    nav: {
      label: "Main",
      home: "Home",
      overview: "Overview",
      meetings: "Meetings",
      councillors: "Councillors",
      committees: "Committees",
      guide: "How councils work",
      topics: "Topics",
      compare: "Compare councils",
      search: "Search",
      find: "Your councillors",
      about: "About",
    },
    lang: {
      other: "Cymraeg",
      otherLabel: "Darllen y dudalen hon yn Gymraeg",
    },
    footer: {
      independent:
        "OpenCouncils is an independent project. It is not run or endorsed by any council or government.",
      publishedBy: "Published by",
      licence: "Contains public sector information licensed under the",
      licenceLink: "Open Government Licence v3.0",
      licenceUrl: "https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
      otherRights: "Other content: All rights reserved, except where the [open data page](data) says otherwise.",
      familyTitle: "Part of the Edau family",
      family: {
        opensenedd: { name: "OpenSenedd", note: "What the Senedd debates and decides" },
        opencouncil: { name: "OpenCouncils", note: "Every council in the UK" },
        opencharity: { name: "OpenCharity", note: "Every charity in Wales" },
        openeconomy: { name: "OpenEconomy", note: "The Welsh economy in figures" },
      },
      edau: "Data from [Edau](edau), Datblygu Cymru's store of Welsh public data.",
      sisterNote: "For Welsh councils in more depth, in English and Welsh, see [OpenCouncil](sister).",
      about: "About OpenCouncils",
      contact: "Contact",
    },
    words: {
      source: "Source",
      date: "Date",
      all: "All",
      previous: "Previous",
      next: "Next",
      page: "Page",
      of: "of",
      noResults: "Nothing matches these filters.",
      loading: "Loading",
      councillor: "Councillor",
      formerCouncillor: "Former councillor",
      ward: "Ward",
      party: "Party",
      none: "None",
    },
    notFound: {
      title: "Page not found",
      body: "There is no page at this address. It may have moved, or the link may be wrong.",
      home: "Go to the home page",
      search: "Search OpenCouncil",
    },
    /** The beta notice above the top bar (src/components/beta-banner.tsx). `short` is the one line shown on phones. */
    beta: {
      label: "Beta notice",
      long: "**Beta** OpenCouncil reads the councils' own data every day, but if something looks wrong please tell us at [{email}](email).",
      short: "**Beta** Something wrong? [{email}](email)",
      dismiss: "Hide this notice",
    },
  },
  cy: {
    siteName: "OpenCouncil",
    description:
      "Beth mae cynghorau Cymru yn ei benderfynu, a pham, mewn Cymraeg a Saesneg clir. Cyfarfodydd, cynghorwyr, presenoldeb a datganiadau o fuddiant. Annibynnol ac am ddim.",
    skipToContent: "Neidio i'r cynnwys",
    nav: {
      label: "Prif ddewislen",
      home: "Hafan",
      overview: "Trosolwg",
      meetings: "Cyfarfodydd",
      councillors: "Cynghorwyr",
      committees: "Pwyllgorau",
      guide: "Sut mae cynghorau'n gweithio",
      topics: "Pynciau",
      compare: "Cymharu cynghorau",
      search: "Chwilio",
      find: "Eich cynghorwyr",
      about: "Amdanom ni",
    },
    lang: {
      other: "English",
      otherLabel: "Read this page in English",
    },
    footer: {
      independent:
        "Prosiect annibynnol yw OpenCouncil. Nid yw'n cael ei redeg na'i gymeradwyo gan unrhyw gyngor na gan Lywodraeth Cymru.",
      publishedBy: "Cyhoeddwyd gan",
      licence: "Yn cynnwys gwybodaeth y sector cyhoeddus a drwyddedir o dan y",
      licenceLink: "Drwydded Llywodraeth Agored v3.0",
      licenceUrl: "https://www.nationalarchives.gov.uk/doc/open-government-licence-cymraeg/version/3/",
      otherRights: "Cynnwys arall: Cedwir pob hawl, ac eithrio lle mae'r [dudalen data agored](data) yn dweud yn wahanol.",
      familyTitle: "Rhan o deulu Edau",
      family: {
        opensenedd: { name: "OpenSenedd", note: "Beth mae'r Senedd yn ei drafod a'i benderfynu" },
        opencouncil: { name: "OpenCouncil", note: "Beth mae 22 cyngor Cymru yn ei benderfynu" },
        opencharity: { name: "OpenCharity", note: "Pob elusen yng Nghymru" },
        openeconomy: { name: "OpenEconomy", note: "Economi Cymru mewn ffigurau" },
      },
      edau: "Data o [Edau](edau), storfa Datblygu Cymru o ddata cyhoeddus Cymru.",
      sisterNote: "Am gynghorau Cymru yn fanylach, gweler [OpenCouncil](sister).",
      about: "Am OpenCouncil",
      contact: "Cysylltu",
    },
    words: {
      source: "Ffynhonnell",
      date: "Dyddiad",
      all: "Y cyfan",
      previous: "Blaenorol",
      next: "Nesaf",
      page: "Tudalen",
      of: "o",
      noResults: "Does dim byd yn cyfateb i'r hidlwyr hyn.",
      loading: "Wrthi'n llwytho",
      councillor: "Cynghorydd",
      formerCouncillor: "Cyn-gynghorydd",
      ward: "Ward",
      party: "Plaid",
      none: "Dim",
    },
    notFound: {
      title: "Heb ddod o hyd i'r dudalen",
      body: "Does dim tudalen yn y cyfeiriad hwn. Efallai ei bod wedi symud, neu fod y ddolen yn anghywir.",
      home: "Mynd i'r hafan",
      search: "Chwilio OpenCouncil",
    },
    beta: {
      label: "Hysbysiad beta",
      long: "**Beta** Mae OpenCouncil yn darllen data'r cynghorau eu hunain bob dydd, ond os oes rhywbeth yn edrych yn anghywir, e-bostiwch [{email}](email).",
      short: "**Beta** Rhywbeth o'i le? [{email}](email)",
      dismiss: "Cuddio'r hysbysiad hwn",
    },
  },
});
