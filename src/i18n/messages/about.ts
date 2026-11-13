import { defineMessages } from "../server";

export const aboutMessages = defineMessages({
  en: {
    title: "About OpenCouncils",
    lede: "OpenCouncils makes Welsh councils' public records easy to follow. It is independent, free and run on public data.",
    sections: [
      {
        title: "Where the information comes from",
        body: [
          "Every council in Wales publishes its meetings, agendas, reports and minutes. Most use a system called ModernGov, which also offers the same information as open data. OpenCouncils reads that data every day.",
          "Councillors, wards, committees, meeting dates, attendance and the papers for each meeting come straight from the council. Nothing is estimated. If the council hasn't published something, OpenCouncils says so.",
          "Two things are read from pages on a council's own website instead: the posts its Cabinet members hold, where the open data doesn't give them, and its list of the decisions it plans to take. OpenCouncils reads these only where the council's website allows automated readers, and says which councils are left out.",
        ],
      },
      {
        title: "How the summaries are written",
        body: [
          "Councils don't publish a word-for-word record of what is said in meetings. Instead they publish minutes: a short official record of what each meeting decided. Once the minutes are out, OpenCouncils uses AI to explain each decision and the reasons given for it in plain English and Welsh. Before then, for the main meetings, it explains what the reports on the agenda propose, and says plainly that nothing has been decided yet.",
          "The AI is given only that meeting's minutes and reports. It is told to state a decision only when the minutes record one, and every item links to the documents it was written from. Any sentence with a number or a name that can't be found in those papers is removed automatically. Summaries can still contain mistakes, so the official papers are always one click away.",
          "Summaries cover meetings of the full Council, the Cabinet, scrutiny committees and planning committees back to May 2022, where OpenCouncils holds them, and other committees' meetings from the last year. There is a monthly spending limit, so a few meetings may wait for a summary.",
        ],
      },
      {
        title: "Declarations of interest",
        body: [
          "When councillors declare an interest at a meeting, the minutes record it. OpenCouncils reads those declarations from the minutes and links each one to the councillor when the name matches exactly one councillor.",
        ],
      },
      {
        title: "Which councils are covered",
        body: [
          "OpenCouncils covers all 22 Welsh councils, but not every part of every council's record is complete yet. Meeting history goes back to May 2022 for some councils and only a few weeks for others. Some councils' websites block downloads of their reports, so their summaries rest on the minutes alone. Where a council's councillors or meetings haven't loaded, its pages say so.",
        ],
      },
    ],
    statusTitle: "Data status",
    statusLede: "When each part of the daily update last ran.",
    job: "Update",
    lastRun: "Last run",
    result: "Result",
    results: { ok: "Completed", partial: "Completed with gaps", failed: "Failed", running: "Running" },
    neverRun: "The daily update hasn't run yet.",
    contactTitle: "Contact",
    contactBody: "Spotted a mistake, or want your council covered sooner? Email [{email}](email).",
  },
  cy: {
    title: "Am OpenCouncils",
    lede: "Mae OpenCouncils yn gwneud cofnodion cyhoeddus cynghorau Cymru yn hawdd eu dilyn. Mae'n annibynnol, am ddim ac yn defnyddio data cyhoeddus.",
    sections: [
      {
        title: "O ble mae'r wybodaeth yn dod",
        body: [
          "Mae pob cyngor yng Nghymru yn cyhoeddi ei gyfarfodydd, agendâu, adroddiadau a chofnodion. Mae'r rhan fwyaf yn defnyddio system o'r enw ModernGov, sydd hefyd yn cynnig yr un wybodaeth fel data agored. Mae OpenCouncils yn darllen y data hwnnw bob dydd.",
          "Mae cynghorwyr, wardiau, pwyllgorau, dyddiadau cyfarfodydd, presenoldeb a phapurau pob cyfarfod yn dod yn syth gan y cyngor. Does dim byd yn cael ei amcangyfrif. Os nad yw'r cyngor wedi cyhoeddi rhywbeth, mae OpenCouncils yn dweud hynny.",
          "Mae dau beth yn cael eu darllen o dudalennau ar wefan y cyngor ei hun yn lle hynny: y swyddi sydd gan aelodau ei Gabinet, lle nad yw'r data agored yn eu rhoi, a'i restr o'r penderfyniadau y mae'n bwriadu eu gwneud. Dim ond lle mae gwefan y cyngor yn caniatáu darllenwyr awtomatig y mae OpenCouncils yn darllen y rhain, ac mae'n dweud pa gynghorau sydd wedi'u gadael allan.",
        ],
      },
      {
        title: "Sut mae'r crynodebau'n cael eu hysgrifennu",
        body: [
          "Dyw cynghorau ddim yn cyhoeddi cofnod gair am air o'r hyn sy'n cael ei ddweud mewn cyfarfodydd. Yn hytrach, maen nhw'n cyhoeddi cofnodion: cofnod swyddogol byr o'r hyn a benderfynodd pob cyfarfod. Unwaith y bydd y cofnodion wedi'u cyhoeddi, mae OpenCouncils yn defnyddio AI i esbonio pob penderfyniad a'r rhesymau a roddwyd drosto mewn Cymraeg a Saesneg clir. Cyn hynny, ar gyfer y prif gyfarfodydd, mae'n esbonio beth mae'r adroddiadau ar yr agenda yn ei gynnig, ac yn dweud yn glir nad oes dim wedi'i benderfynu eto.",
          "Dim ond cofnodion ac adroddiadau'r cyfarfod hwnnw y mae'r AI yn eu cael. Mae'n cael ei gyfarwyddo i nodi penderfyniad dim ond pan fydd y cofnodion yn ei gofnodi, ac mae pob eitem yn cysylltu â'r dogfennau y cafodd ei hysgrifennu ohonyn nhw. Mae unrhyw frawddeg â rhif neu enw na ellir dod o hyd iddo yn y papurau hynny'n cael ei thynnu'n awtomatig. Gall crynodebau gynnwys camgymeriadau o hyd, felly mae'r papurau swyddogol bob amser un clic i ffwrdd.",
          "Mae crynodebau'n ymdrin â chyfarfodydd y Cyngor llawn, y Cabinet, pwyllgorau craffu a phwyllgorau cynllunio yn ôl i fis Mai 2022, lle mae gan OpenCouncils nhw, a chyfarfodydd pwyllgorau eraill o'r flwyddyn ddiwethaf. Mae terfyn gwario misol, felly gall ambell gyfarfod aros am grynodeb.",
        ],
      },
      {
        title: "Datganiadau o fuddiant",
        body: [
          "Pan fydd cynghorwyr yn datgan buddiant mewn cyfarfod, mae'r cofnodion yn ei gofnodi. Mae OpenCouncils yn darllen y datganiadau hynny o'r cofnodion ac yn cysylltu pob un â'r cynghorydd pan fydd yr enw'n cyfateb i un cynghorydd yn unig.",
        ],
      },
      {
        title: "Pa gynghorau sydd wedi'u cynnwys",
        body: [
          "Mae OpenCouncils yn ymdrin â phob un o 22 cyngor Cymru, ond nid yw pob rhan o gofnod pob cyngor yn gyflawn eto. Mae hanes cyfarfodydd yn mynd yn ôl i fis Mai 2022 ar gyfer rhai cynghorau a dim ond ychydig wythnosau ar gyfer eraill. Mae gwefannau rhai cynghorau'n rhwystro lawrlwytho eu hadroddiadau, felly mae eu crynodebau'n seiliedig ar y cofnodion yn unig. Lle nad yw cynghorwyr neu gyfarfodydd cyngor wedi'u llwytho, mae ei dudalennau'n dweud hynny.",
        ],
      },
    ],
    statusTitle: "Statws y data",
    statusLede: "Pryd y rhedodd pob rhan o'r diweddariad dyddiol ddiwethaf.",
    job: "Diweddariad",
    lastRun: "Rhedodd ddiwethaf",
    result: "Canlyniad",
    results: { ok: "Wedi'i gwblhau", partial: "Wedi'i gwblhau gyda bylchau", failed: "Wedi methu", running: "Yn rhedeg" },
    neverRun: "Dyw'r diweddariad dyddiol ddim wedi rhedeg eto.",
    contactTitle: "Cysylltu",
    contactBody: "Wedi gweld camgymeriad, neu eisiau i'ch cyngor gael ei gynnwys yn gynt? Anfonwch e-bost at [{email}](email).",
  },
});
