/** Strings for the small time charts: the topic timeline and the week strip. */
import { defineMessages } from "../server";

export const timelineMessages = defineMessages({
  en: {
    title: "When the council's main committees took up {topic}",
    lede: "Meetings with business on this topic each month, {from} to {to}. A darker square means more meetings; an outlined square means none.",
    legend: ["None", "1 meeting", "2 or 3", "4 or more"],
    month: "Month",
    meetingOne: "{n} meeting",
    meetingMany: "{n} meetings",
    weekTitle: "What meets in the next seven days",
    weekNone: "Nothing",
    weekCount: "{n} meetings",
    weekCountOne: "1 meeting",
    weekSummary: "{day}: {list}",
    weekLink: "See the list",
  },
  cy: {
    title: "Pryd y bu prif bwyllgorau'r cyngor yn trafod {topic}",
    lede: "Cyfarfodydd â busnes ar y pwnc hwn bob mis, {from} i {to}. Mae sgwâr tywyllach yn golygu mwy o gyfarfodydd; mae sgwâr gwag yn golygu dim un.",
    legend: ["Dim", "1 cyfarfod", "2 neu 3", "4 neu fwy"],
    month: "Mis",
    meetingOne: "{n} cyfarfod",
    meetingMany: "{n} cyfarfod",
    weekTitle: "Beth sy'n cyfarfod yn ystod y saith diwrnod nesaf",
    weekNone: "Dim",
    weekCount: "{n} cyfarfod",
    weekCountOne: "1 cyfarfod",
    weekSummary: "{day}: {list}",
    weekLink: "Gweld y rhestr",
  },
});
