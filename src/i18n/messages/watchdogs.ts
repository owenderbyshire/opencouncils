/**
 * Strings for "What the watchdogs say" on a council's "How it's doing" page:
 * Audit Wales reports about the council and the Ombudsman's annual letters,
 * copied from Edau. Report titles and summaries are Audit Wales's own words;
 * where there is no Welsh, pages mark the English `lang="en"`.
 */
import { defineMessages } from "../server";

export const watchdogsMessages = defineMessages({
  en: {
    title: "What the watchdogs say",
    lede: "Independent watchdogs check the work of councils and publish what they find. Here is what they have published about this council, as far as OpenCouncils holds it.",
    auditTitle: "Audit Wales reports about {name}",
    auditCount: { one: "{n} report", other: "{n} reports" },
    auditHelp: "Audit Wales checks the council's accounts and how well it plans and runs its services, for the Auditor General for Wales. Each report's title, date and short summary are Audit Wales's own. The newest come first.",
    aiTitle: { one: "{n} finding read by AI", other: "{n} findings read by AI" },
    aiLabel: "Written by AI. Edau, the data store that supplies OpenCouncils, used AI to read these findings from the report, then checked each one automatically against the page it cites. Mistakes are still possible, so follow the page link to read the report itself.",
    aiShown: "{shown} of the {total} findings are shown here. The rest are in the report.",
    kinds: { recommendation: "Recommendation", risk: "Risk", spend: "Money", decision: "Decision", figure: "Figure" } as Record<string, string>,
    page: "page {n}",
    pdf: "Report (PDF)",
    pdfCy: "Welsh report (PDF)",
    showAll: "Show all {n} reports",
    lettersTitle: "The Ombudsman's annual letters",
    lettersHelp: "The Public Services Ombudsman for Wales looks into complaints about council services and about councillors' conduct. Each year the Ombudsman writes to every council about the complaints it received about the council and what happened to them. Each letter is a PDF on the Ombudsman's website, for the financial year shown (April to March).",
    letterLabel: "Annual letter for {year} (PDF)",
    source: "Copied from Edau, which collects these records from Audit Wales and the Ombudsman.",
    reportProblem: "Report a problem with this section",
  },
  cy: {
    title: "Beth mae'r cyrff gwarchod yn ei ddweud",
    lede: "Mae cyrff gwarchod annibynnol yn gwirio gwaith cynghorau ac yn cyhoeddi'r hyn maen nhw'n ei ganfod. Dyma beth maen nhw wedi'i gyhoeddi am y cyngor hwn, cyn belled ag y mae gan OpenCouncils gofnod ohono.",
    auditTitle: "Adroddiadau Archwilio Cymru am {name}",
    auditCount: { one: "{n} adroddiad", other: "{n} adroddiad" },
    auditHelp: "Mae Archwilio Cymru yn gwirio cyfrifon y cyngor a pha mor dda y mae'n cynllunio ac yn rhedeg ei wasanaethau, ar ran Archwilydd Cyffredinol Cymru. Geiriau Archwilio Cymru yw teitl, dyddiad a chrynodeb byr pob adroddiad. Mae'r diweddaraf yn gyntaf.",
    aiTitle: { one: "{n} canfyddiad a ddarllenwyd gan AI", other: "{n} canfyddiad a ddarllenwyd gan AI" },
    aiLabel: "Wedi'i ysgrifennu gan AI. Defnyddiodd Edau, y storfa ddata sy'n cyflenwi OpenCouncils, AI i ddarllen y canfyddiadau hyn o'r adroddiad, yna gwirio pob un yn awtomatig yn erbyn y dudalen y mae'n ei nodi. Mae camgymeriadau'n dal yn bosibl, felly dilynwch ddolen y dudalen i ddarllen yr adroddiad ei hun.",
    aiShown: "Dangosir {shown} o'r {total} canfyddiad yma. Mae'r lleill yn yr adroddiad.",
    kinds: { recommendation: "Argymhelliad", risk: "Risg", spend: "Arian", decision: "Penderfyniad", figure: "Ffigur" } as Record<string, string>,
    page: "tudalen {n}",
    pdf: "Adroddiad (PDF)",
    pdfCy: "Adroddiad Cymraeg (PDF)",
    showAll: "Dangos pob un o'r {n} adroddiad",
    lettersTitle: "Llythyrau blynyddol yr Ombwdsmon",
    lettersHelp: "Mae Ombwdsmon Gwasanaethau Cyhoeddus Cymru yn ymchwilio i gwynion am wasanaethau'r cyngor ac am ymddygiad cynghorwyr. Bob blwyddyn mae'r Ombwdsmon yn ysgrifennu at bob cyngor am y cwynion a gafodd am y cyngor a beth ddigwyddodd iddyn nhw. PDF ar wefan yr Ombwdsmon yw pob llythyr, ar gyfer y flwyddyn ariannol a ddangosir (Ebrill i Fawrth).",
    letterLabel: "Llythyr blynyddol {year} (PDF)",
    source: "Wedi'u copïo o Edau, sy'n casglu'r cofnodion hyn gan Archwilio Cymru a'r Ombwdsmon.",
    reportProblem: "Rhoi gwybod am broblem gyda'r adran hon",
  },
});
