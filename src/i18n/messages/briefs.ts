/** Strings for the monthly topic overviews on each topic's page. */
import { defineMessages } from "../server";

export const briefMessages = defineMessages({
  en: {
    title: "This month",
    written: "Written in {month} from council records since {from}, open consultations and official sources.",
    how: "Written automatically, then checked: every point names its sources and every figure appears in them. Follow the links to check anything before relying on it.",
    sections: { happening: "What's happening", issues: "Pressing issues", policy: "The policy context" },
    sources: "Sources",
    meeting: "{council} meeting, {date}",
    consultation: "Consultation",
    official: "Official source",
  },
  cy: {
    title: "Y mis hwn",
    written: "Wedi'i ysgrifennu ym mis {month} o gofnodion cynghorau ers {from}, ymgynghoriadau agored a ffynonellau swyddogol.",
    how: "Wedi'i ysgrifennu'n awtomatig, yna wedi'i wirio: mae pob pwynt yn enwi ei ffynonellau ac mae pob ffigur yn ymddangos ynddynt. Dilynwch y dolenni i wirio unrhyw beth cyn dibynnu arno.",
    sections: { happening: "Beth sy'n digwydd", issues: "Materion pwysig", policy: "Y cyd-destun polisi" },
    sources: "Ffynonellau",
    meeting: "Cyfarfod {council}, {date}",
    consultation: "Ymgynghoriad",
    official: "Ffynhonnell swyddogol",
  },
});

/** Strings for the monthly overview on each council's page. */
export const councilBriefMessages = defineMessages({
  en: {
    title: "At a glance",
    sections: { priorities: "The council's priorities", recent: "Recent decisions", watch: "What to watch for" },
    written: "Written in {month} from the council's records since {from}, its agendas for the next six weeks, its consultations, and its own and official websites.",
    how: "Written automatically, then checked: every point names its sources and every figure appears in them. Follow the links to check anything before relying on it.",
    sources: "Sources",
    meeting: "Meeting, {date}",
    agenda: "On the agenda, {date}",
    consultation: "Consultation",
    fact: "Councillors and control",
  },
  cy: {
    title: "Cipolwg",
    sections: { priorities: "Blaenoriaethau'r cyngor", recent: "Penderfyniadau diweddar", watch: "Beth i gadw llygad arno" },
    written: "Wedi'i ysgrifennu ym mis {month} o gofnodion y cyngor ers {from}, ei agendâu am y chwe wythnos nesaf, ei ymgynghoriadau, a'i wefan ei hun a gwefannau swyddogol.",
    how: "Wedi'i ysgrifennu'n awtomatig, yna wedi'i wirio: mae pob pwynt yn enwi ei ffynonellau ac mae pob ffigur yn ymddangos ynddynt. Dilynwch y dolenni i wirio unrhyw beth cyn dibynnu arno.",
    sources: "Ffynonellau",
    meeting: "Cyfarfod, {date}",
    agenda: "Ar yr agenda, {date}",
    consultation: "Ymgynghoriad",
    fact: "Cynghorwyr a rheolaeth",
  },
});
