/**
 * Strings for taking part: what someone can do about a meeting, and the
 * outside services that help people contact or hold councillors to account.
 */
import { defineMessages } from "../server";

export const engageMessages = defineMessages({
  en: {
    title: "Take part",
    upcoming: {
      watch:
        "Most council meetings are open to the public, and many are broadcast live. The council's page for this meeting has the venue and, where there is one, the webcast link.",
      speakPlanning:
        "If you have commented on an application on this agenda, you may be able to speak to the committee before it decides. Each council sets its own rules and deadline, usually a few working days before the meeting. Ask the council's democratic services team.",
      question:
        "Most councils let residents ask a question at a full Council meeting if they send it in by a deadline before the meeting. The council's constitution or website explains how.",
      tellCouncillor: "Tell your councillors what you think before the meeting. They can raise it for you.",
    },
    past: {
      callIn:
        "Most Cabinet decisions don't take effect straight away. For a few days, scrutiny councillors can [call a decision in](callin) to be looked at again.",
      minutes:
        "If you think the minutes are wrong, the committee approves them at its next meeting. Contact a councillor on the committee before then.",
      followUp: "If a decision affects you, your councillors can ask questions about it and how it is carried out.",
    },
    findCouncillors: "Find your councillors",
    officialPage: "This meeting on the council's website",
    howCouncilsWork: "How councils work",
    guideLink: "More in the guide",
    followTitle: "Follow this committee",
    election: "The next council elections in Wales are on **Thursday 6 May 2027**. Every seat on every council is up for election.",
    electionShort: "Next council elections: 6 May 2027",
    servicesTitle: "Other ways to have your say",
    servicesLede: "Free services run by charities, not by the council. They open on their own websites.",
    services: {
      writetothem: {
        name: "WriteToThem",
        note: "Write to your councillors, Senedd members and MP from one form.",
      },
      fixmystreet: {
        name: "FixMyStreet",
        note: "Report potholes, fly-tipping, broken street lights and other problems to the right council.",
      },
      whocanivotefor: {
        name: "Who Can I Vote For?",
        note: "See which elections are coming up where you live, and who is standing.",
      },
    },
    servicesBy: "WriteToThem and FixMyStreet are run by mySociety. Who Can I Vote For? is run by Democracy Club.",
  },
  cy: {
    title: "Cymryd rhan",
    upcoming: {
      watch:
        "Mae'r rhan fwyaf o gyfarfodydd cyngor yn agored i'r cyhoedd, a llawer yn cael eu darlledu'n fyw. Mae tudalen y cyngor ar gyfer y cyfarfod hwn yn rhoi'r lleoliad ac, os oes un, y ddolen i'r gweddarllediad.",
      speakPlanning:
        "Os ydych wedi rhoi sylwadau ar gais sydd ar yr agenda hon, efallai y gallwch siarad â'r pwyllgor cyn iddo benderfynu. Mae pob cyngor yn gosod ei reolau a'i ddyddiad cau ei hun, fel arfer ychydig ddyddiau gwaith cyn y cyfarfod. Holwch dîm gwasanaethau democrataidd y cyngor.",
      question:
        "Mae'r rhan fwyaf o gynghorau yn gadael i drigolion ofyn cwestiwn mewn cyfarfod o'r Cyngor llawn os ydyn nhw'n ei anfon erbyn dyddiad cau cyn y cyfarfod. Mae cyfansoddiad neu wefan y cyngor yn esbonio sut.",
      tellCouncillor: "Dywedwch wrth eich cynghorwyr beth yw eich barn cyn y cyfarfod. Gallan nhw ei godi ar eich rhan.",
    },
    past: {
      callIn:
        "Nid yw'r rhan fwyaf o benderfyniadau'r Cabinet yn dod i rym yn syth. Am ychydig ddyddiau, gall cynghorwyr craffu [alw penderfyniad i mewn](callin) i'w ystyried eto.",
      minutes:
        "Os ydych yn credu bod y cofnodion yn anghywir, mae'r pwyllgor yn eu cymeradwyo yn ei gyfarfod nesaf. Cysylltwch â chynghorydd ar y pwyllgor cyn hynny.",
      followUp: "Os yw penderfyniad yn effeithio arnoch chi, gall eich cynghorwyr ofyn cwestiynau amdano a sut mae'n cael ei roi ar waith.",
    },
    findCouncillors: "Dod o hyd i'ch cynghorwyr",
    officialPage: "Y cyfarfod hwn ar wefan y cyngor",
    howCouncilsWork: "Sut mae cynghorau'n gweithio",
    guideLink: "Mwy yn y canllaw",
    followTitle: "Dilyn y pwyllgor hwn",
    election: "Mae'r etholiadau cyngor nesaf yng Nghymru ar **ddydd Iau 6 Mai 2027**. Mae pob sedd ar bob cyngor yn cael ei hethol.",
    electionShort: "Etholiadau cyngor nesaf: 6 Mai 2027",
    servicesTitle: "Ffyrdd eraill o ddweud eich dweud",
    servicesLede: "Gwasanaethau am ddim sy'n cael eu rhedeg gan elusennau, nid gan y cyngor. Maen nhw'n agor ar eu gwefannau eu hunain.",
    services: {
      writetothem: {
        name: "WriteToThem",
        note: "Ysgrifennu at eich cynghorwyr, Aelodau o'r Senedd ac AS o un ffurflen. Yn Saesneg.",
      },
      fixmystreet: {
        name: "FixMyStreet",
        note: "Rhoi gwybod am dyllau yn y ffordd, tipio anghyfreithlon, goleuadau stryd wedi torri a phroblemau eraill i'r cyngor cywir. Yn Saesneg.",
      },
      whocanivotefor: {
        name: "Who Can I Vote For?",
        note: "Gweld pa etholiadau sydd ar y gweill lle rydych chi'n byw, a phwy sy'n sefyll. Yn Saesneg.",
      },
    },
    servicesBy: "Mae WriteToThem a FixMyStreet yn cael eu rhedeg gan mySociety. Mae Who Can I Vote For? yn cael ei redeg gan Democracy Club.",
  },
});
