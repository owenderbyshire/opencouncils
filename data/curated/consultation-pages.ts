/**
 * Where each council lists its own consultations. None publishes a feed, so
 * the site links here; councils whose pages carry dates are also read by
 * pipeline/jobs/consultations.ts. Checked 27 October 2026. `cy` is null where
 * the Welsh page's address isn't confirmed.
 */
export interface CouncilConsultationPage {
  en: string;
  cy: string | null;
}

export const CONSULTATION_PAGES: Record<string, CouncilConsultationPage> = {
  anglesey: { en: "https://www.anglesey.gov.wales/en/Have-your-say/Consultations/", cy: null },
  gwynedd: { en: "https://www.gwynedd.llyw.cymru/en-gb/have-your-say/recent-consultations-and-surveys", cy: null },
  conwy: {
    en: "https://www.conwy.gov.uk/en/Council/Have-your-say/Consultations/Consultations.aspx",
    cy: "https://www.conwy.gov.uk/cy/Council/Have-your-say/Consultations/Consultations.aspx",
  },
  denbighshire: { en: "https://www.denbighshire.gov.uk/en/your-council/consultations/consultations.aspx", cy: null },
  flintshire: {
    en: "https://www.flintshire.gov.uk/en/Resident/Consultation-and-Engagement/Open/Home.aspx",
    cy: null,
  },
  wrexham: { en: "https://yourvoice.wrexham.gov.uk", cy: null },
  powys: { en: "https://en.powys.gov.uk/article/790/Current-Consultations", cy: "https://cy.powys.gov.uk/dweudeichdweud" },
  ceredigion: {
    en: "https://www.ceredigion.gov.uk/your-council/consultations/open-campaigns/",
    cy: "https://www.ceredigion.gov.uk/eich-cyngor/ymgynghoriadau/ymgyrchoedd-ar-agor/",
  },
  pembrokeshire: {
    en: "https://www.pembrokeshire.gov.uk/have-your-say/consultations",
    cy: "https://www.sir-benfro.gov.uk/dweud-eich-dweud/ymgynghoriadau",
  },
  carmarthenshire: {
    en: "https://www.carmarthenshire.gov.wales/council-democracy/have-your-say/",
    cy: "https://www.sirgar.llyw.cymru/cyngor-a-democratiaeth/dweud-eich-dweud/",
  },
  swansea: { en: "https://www.swansea.gov.uk/haveyoursay", cy: null },
  "neath-port-talbot": {
    en: "https://www.npt.gov.uk/council/have-your-say/consultations/",
    cy: "https://www.npt.gov.uk/cy/cyngor/dweud-eich-dweud/ymgynghoriadau/?lang=cy-gb",
  },
  bridgend: {
    en: "https://www.bridgend.gov.uk/council/consultations",
    cy: "https://www.penybontarogwr.gov.uk/cyngor/ymgynghoriadau/",
  },
  "vale-of-glamorgan": { en: "https://www.valeofglamorgan.gov.uk/en/our_council/consultation", cy: null },
  "rhondda-cynon-taf": {
    en: "https://www.rctcbc.gov.uk/EN/GetInvolved/Consultations/CurrentConsultations/CurrentConsultations.aspx",
    cy: "https://www.rctcbc.gov.uk/CY/GetInvolved/Consultations/CurrentConsultations/CurrentConsultations.aspx",
  },
  "merthyr-tydfil": {
    en: "https://www.merthyr.gov.uk/council/have-your-say",
    cy: "https://www.merthyr.gov.uk/council/have-your-say?lang=cy-GB",
  },
  caerphilly: { en: "https://conversation.caerphilly.gov.uk", cy: "https://trafodaeth.caerphilly.gov.uk" },
  "blaenau-gwent": {
    en: "https://www.blaenau-gwent.gov.uk/en/council/consultations",
    cy: "https://www.blaenau-gwent.gov.uk/cy/cyngor/ymgynghoriadau/",
  },
  torfaen: { en: "https://getinvolved.torfaen.gov.uk", cy: null },
  monmouthshire: { en: "https://letstalkmonmouthshire.co.uk", cy: "https://sgwrsioamsirfynwy.co.uk" },
  newport: {
    en: "https://www.newport.gov.uk/our-council/have-your-say/our-council/have-your-say/open-consultations",
    cy: "https://www.casnewydd.gov.uk/ein-cyngor/dweud-eich-dweud/ein-cyngor/dweud-eich-dweud/ymgynghoriadau-agored",
  },
  cardiff: { en: "https://www.cardiff.gov.uk/haveyoursay", cy: "https://www.caerdydd.gov.uk/dweudeichdweud" },
};

export function consultationPage(councilId: string, locale: "en" | "cy"): string | null {
  const p = CONSULTATION_PAGES[councilId];
  if (!p) return null;
  return locale === "cy" ? (p.cy ?? p.en) : p.en;
}
