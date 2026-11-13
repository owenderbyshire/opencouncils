/**
 * Wales's 25 local planning authorities: the 22 councils and the three
 * national park authorities, which decide planning applications inside their
 * parks. `planitId` is the authority's area number in UK PlanIt, checked
 * against PlanIt's list of areas on 27 October 2026; `planit` lists names
 * to fall back on. `portal` is
 * the authority's public search of applications. Checked October 2026.
 */
export interface PlanningAuthority {
  id: string;
  nameEn: string;
  nameCy: string;
  kind: "council" | "national-park";
  /** The council, for councils. */
  councilId: string | null;
  planitId: number;
  planit: string[];
  portal: string;
}

type Row = [planitId: number, id: string, nameEn: string, nameCy: string, councilId: string | null, planit: string[], portal: string];

const ROWS: Row[] = [
  [398, "anglesey", "Isle of Anglesey", "Ynys Môn", "anglesey", ["Anglesey", "Isle of Anglesey", "Ynys Mon"], "https://planning-public-register.anglesey.gov.wales/prIoA/s/register-view?language=en_GB&c__r=Arcus_BE_Public_Register"],
  [399, "gwynedd", "Gwynedd", "Gwynedd", "gwynedd", ["Gwynedd"], "https://amg.gwynedd.llyw.cymru/planning/index.html?language=en&fa=search"],
  [400, "conwy", "Conwy", "Conwy", "conwy", ["Conwy"], "https://npe.conwy.gov.uk/Northgate/EnglishPlanningExplorer/generalsearch.aspx"],
  [401, "denbighshire", "Denbighshire", "Sir Ddinbych", "denbighshire", ["Denbighshire"], "https://planning.denbighshire.gov.uk/planning"],
  [402, "flintshire", "Flintshire", "Sir y Fflint", "flintshire", ["Flintshire"], "https://planning.agileapplications.co.uk/flintshire"],
  [403, "wrexham", "Wrexham", "Wrecsam", "wrexham", ["Wrexham"], "https://register.wrexham.gov.uk/pr/s/register-view?c__r=Arcus_BE_Public_Register&language=en_GB"],
  [418, "powys", "Powys", "Powys", "powys", ["Powys"], "https://pa.powys.gov.uk/online-applications/"],
  [404, "ceredigion", "Ceredigion", "Ceredigion", "ceredigion", ["Ceredigion"], "https://ceredigion-online.tascomi.com/planning/index.html?fa=search&language=en"],
  [405, "pembrokeshire", "Pembrokeshire", "Sir Benfro", "pembrokeshire", ["Pembrokeshire"], "https://planning.agileapplications.co.uk/pembrokeshire"],
  [406, "carmarthenshire", "Carmarthenshire", "Sir Gaerfyrddin", "carmarthenshire", ["Carmarthenshire"], "https://carmarthenshire.my.site.com/en/s"],
  [407, "swansea", "Swansea", "Abertawe", "swansea", ["Swansea"], "https://property.swansea.gov.uk/online-applications/"],
  [408, "neath-port-talbot", "Neath Port Talbot", "Castell-nedd Port Talbot", "neath-port-talbot", ["Neath Port Talbot", "Neath and Port Talbot", "NPT"], "https://planningonline.npt.gov.uk/online-applications/"],
  [409, "bridgend", "Bridgend", "Pen-y-bont ar Ogwr", "bridgend", ["Bridgend"], "https://planning.bridgend.gov.uk/"],
  [410, "vale-of-glamorgan", "Vale of Glamorgan", "Bro Morgannwg", "vale-of-glamorgan", ["Vale of Glamorgan", "Glamorgan"], "https://vogonline.planning-register.co.uk/"],
  [412, "rhondda-cynon-taf", "Rhondda Cynon Taf", "Rhondda Cynon Taf", "rhondda-cynon-taf", ["Rhondda Cynon Taf", "Rhondda", "RCT"], "https://planonline.rctcbc.gov.uk/online-applications/"],
  [419, "merthyr-tydfil", "Merthyr Tydfil", "Merthyr Tudful", "merthyr-tydfil", ["Merthyr Tydfil", "Merthyr"], "http://publicaccess.merthyr.gov.uk/online-applications/"],
  [413, "caerphilly", "Caerphilly", "Caerffili", "caerphilly", ["Caerphilly"], "https://publicaccess.caerphilly.gov.uk/PublicAccess/"],
  [414, "blaenau-gwent", "Blaenau Gwent", "Blaenau Gwent", "blaenau-gwent", ["Blaenau Gwent"], "https://developmentservices.blaenau-gwent.gov.uk/planning/index.html"],
  [415, "torfaen", "Torfaen", "Torfaen", "torfaen", ["Torfaen"], "https://planningonline.torfaen.gov.uk/online-applications/"],
  [416, "monmouthshire", "Monmouthshire", "Sir Fynwy", "monmouthshire", ["Monmouthshire"], "https://planningonline.monmouthshire.gov.uk/online-applications/"],
  [417, "newport", "Newport", "Casnewydd", "newport", ["Newport"], "https://publicaccess.newport.gov.uk/online-applications/"],
  [411, "cardiff", "Cardiff", "Caerdydd", "cardiff", ["Cardiff"], "https://www.cardiffidoxcloud.wales/publicaccess/"],
  [420, "bannau-brycheiniog", "Bannau Brycheiniog National Park", "Parc Cenedlaethol Bannau Brycheiniog", null, ["Bannau Brycheiniog", "Brecon Beacons", "Brecon Beacons National Park"], "https://planning.beacons-npa.gov.uk/online-applications/"],
  [422, "eryri", "Eryri National Park", "Parc Cenedlaethol Eryri", null, ["Eryri", "Snowdonia", "Snowdonia National Park"], "https://planning.agileapplications.co.uk/snowdonia"],
  [421, "pembrokeshire-coast", "Pembrokeshire Coast National Park", "Parc Cenedlaethol Arfordir Penfro", null, ["Pembrokeshire Coast", "Pembrokeshire Coast National Park"], "https://planning.agileapplications.co.uk/pcnpa"],
];

export const PLANNING_AUTHORITIES: PlanningAuthority[] = ROWS.map(([planitId, id, nameEn, nameCy, councilId, planit, portal]) => ({
  planitId,
  id,
  nameEn,
  nameCy,
  kind: councilId ? "council" : "national-park",
  councilId,
  planit,
  portal,
}));

export const planningAuthority = (id: string) => PLANNING_AUTHORITIES.find((a) => a.id === id);
