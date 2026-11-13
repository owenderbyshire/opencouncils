/**
 * Strings for a council area's local figures. Built on the place strings
 * copied from OpenSenedd, with the parts about constituencies replaced.
 */
import { defineMessages } from "../server";
import { placesMessages } from "./places";

export const areaMessages = defineMessages({
  en: {
    ...placesMessages.en,
    tab: "Your area",
    title: "{name}: the area",
    notReady: "OpenCouncil doesn't hold the neighbourhood figures for this council area yet.",
    lede1:
      "What kind of place the council serves, told through its **{n} neighbourhoods** of about 1,600 people each: town and country, Welsh speakers, deprivation and second homes. Hover over or tap a neighbourhood to see its name.",
    yourArea: "Your neighbourhood, from your postcode, is **{name}**. It is outlined on each map.",
    about1:
      "Each neighbourhood (a Lower layer Super Output Area, the smallest area most official statistics are published for) belongs to one council area. A council area's figure for Welsh speakers is the average of its neighbourhoods, which have similar numbers of people.",
    metaPlace: "What kind of place {name} serves: deprivation, Welsh speakers, town and country, and second homes, mapped neighbourhood by neighbourhood.",
    whyTitle: "Why this matters",
    why: "Councils decide where money and services go. Knowing which neighbourhoods are most deprived, where Welsh is spoken and where second homes are concentrated helps you judge their decisions on schools, housing, transport and council tax.",
  },
  cy: {
    ...placesMessages.cy,
    tab: "Eich ardal",
    title: "{name}: yr ardal",
    notReady: "Nid yw OpenCouncil yn dal ffigurau cymdogaethau'r ardal cyngor hon eto.",
    lede1:
      "Pa fath o le mae'r cyngor yn ei wasanaethu, drwy ei **{n} cymdogaeth** o tua 1,600 o bobl yr un: tref a gwlad, siaradwyr Cymraeg, amddifadedd ac ail gartrefi. Hofrwch dros gymdogaeth neu ei thapio i weld ei henw.",
    yourArea: "Eich cymdogaeth chi, o'ch cod post, yw **{name}**. Mae wedi'i hamlinellu ar bob map.",
    about1:
      "Mae pob cymdogaeth (Ardal Gynnyrch Ehangach Haen Is, yr ardal leiaf y cyhoeddir y rhan fwyaf o ystadegau swyddogol ar ei chyfer) yn perthyn i un ardal cyngor. Ffigur ardal cyngor ar gyfer siaradwyr Cymraeg yw cyfartaledd ei chymdogaethau, sydd â niferoedd tebyg o bobl.",
    metaPlace: "Pa fath o le mae {name} yn ei wasanaethu: amddifadedd, siaradwyr Cymraeg, tref a gwlad, ac ail gartrefi, wedi'u mapio fesul cymdogaeth.",
    whyTitle: "Pam mae hyn yn bwysig",
    why: "Mae cynghorau'n penderfynu ble mae arian a gwasanaethau'n mynd. Mae gwybod pa gymdogaethau sydd fwyaf difreintiedig, ble mae'r Gymraeg yn cael ei siarad a ble mae ail gartrefi wedi'u crynhoi yn eich helpu i farnu eu penderfyniadau ar ysgolion, tai, trafnidiaeth a'r dreth gyngor.",
  },
});
