/**
 * The Senedd constituencies (from May 2026) that cover each council area:
 * every constituency holding a twentieth or more of the area, worked out by
 * Edau from the official boundaries on 3 November 2026 (inspect
 * --council-seats). Copied into each product, never imported, so every
 * site can link the same place on its siblings without calling them.
 * Constituency names are the same in English and Welsh.
 */
export const COUNCIL_SEATS: Record<string, { slug: string; name: string }[]> = {
  W06000001: [{ slug: "bangor-conwy-mon", name: "Bangor Conwy Môn" }],
  W06000002: [{ slug: "gwynedd-maldwyn", name: "Gwynedd Maldwyn" }, { slug: "bangor-conwy-mon", name: "Bangor Conwy Môn" }],
  W06000003: [{ slug: "bangor-conwy-mon", name: "Bangor Conwy Môn" }],
  W06000004: [{ slug: "clwyd", name: "Clwyd" }, { slug: "bangor-conwy-mon", name: "Bangor Conwy Môn" }, { slug: "gwynedd-maldwyn", name: "Gwynedd Maldwyn" }],
  W06000005: [{ slug: "clwyd", name: "Clwyd" }, { slug: "fflint-wrecsam", name: "Fflint Wrecsam" }],
  W06000006: [{ slug: "fflint-wrecsam", name: "Fflint Wrecsam" }, { slug: "gwynedd-maldwyn", name: "Gwynedd Maldwyn" }],
  W06000008: [{ slug: "ceredigion-penfro", name: "Ceredigion Penfro" }],
  W06000009: [{ slug: "ceredigion-penfro", name: "Ceredigion Penfro" }],
  W06000010: [{ slug: "sir-gaerfyrddin", name: "Sir Gaerfyrddin" }],
  W06000011: [{ slug: "gwyr-abertawe", name: "Gŵyr Abertawe" }, { slug: "brycheiniog-tawe-nedd", name: "Brycheiniog Tawe Nedd" }],
  W06000012: [{ slug: "brycheiniog-tawe-nedd", name: "Brycheiniog Tawe Nedd" }, { slug: "afan-ogwr-rhondda", name: "Afan Ogwr Rhondda" }],
  W06000013: [{ slug: "afan-ogwr-rhondda", name: "Afan Ogwr Rhondda" }, { slug: "pen-y-bont-bro-morgannwg", name: "Pen-y-bont Bro Morgannwg" }],
  W06000014: [{ slug: "pen-y-bont-bro-morgannwg", name: "Pen-y-bont Bro Morgannwg" }, { slug: "caerdydd-penarth", name: "Caerdydd Penarth" }],
  W06000015: [{ slug: "caerdydd-ffynnon-taf", name: "Caerdydd Ffynnon Taf" }, { slug: "caerdydd-penarth", name: "Caerdydd Penarth" }],
  W06000016: [{ slug: "pontypridd-cynon-merthyr", name: "Pontypridd Cynon Merthyr" }, { slug: "afan-ogwr-rhondda", name: "Afan Ogwr Rhondda" }],
  W06000018: [{ slug: "blaenau-gwent-caerffili-rhymni", name: "Blaenau Gwent Caerffili Rhymni" }, { slug: "casnewydd-islwyn", name: "Casnewydd Islwyn" }],
  W06000019: [{ slug: "blaenau-gwent-caerffili-rhymni", name: "Blaenau Gwent Caerffili Rhymni" }],
  W06000020: [{ slug: "sir-fynwy-torfaen", name: "Sir Fynwy Torfaen" }],
  W06000021: [{ slug: "sir-fynwy-torfaen", name: "Sir Fynwy Torfaen" }],
  W06000022: [{ slug: "casnewydd-islwyn", name: "Casnewydd Islwyn" }],
  W06000023: [{ slug: "brycheiniog-tawe-nedd", name: "Brycheiniog Tawe Nedd" }, { slug: "gwynedd-maldwyn", name: "Gwynedd Maldwyn" }],
  W06000024: [{ slug: "pontypridd-cynon-merthyr", name: "Pontypridd Cynon Merthyr" }],
};
