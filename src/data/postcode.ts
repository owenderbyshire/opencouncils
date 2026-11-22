import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { COUNCILS } from "@/lib/councils";
import { CURRENT_COUNCILS } from "@/lib/register";
import { rows, sql } from "./db";

/**
 * Postcode to council and ward, using postcodes.io (open data from the
 * Office for National Statistics). Ward names from the ONS and from councils
 * don't always match, so a ward is matched only when the names agree.
 */

/** ONS codes of the 22 Welsh councils. */
export const ONS: Record<string, string> = {
  W06000001: "anglesey",
  W06000002: "gwynedd",
  W06000003: "conwy",
  W06000004: "denbighshire",
  W06000005: "flintshire",
  W06000006: "wrexham",
  W06000008: "ceredigion",
  W06000009: "pembrokeshire",
  W06000010: "carmarthenshire",
  W06000011: "swansea",
  W06000012: "neath-port-talbot",
  W06000013: "bridgend",
  W06000014: "vale-of-glamorgan",
  W06000015: "cardiff",
  W06000016: "rhondda-cynon-taf",
  W06000018: "caerphilly",
  W06000019: "blaenau-gwent",
  W06000020: "torfaen",
  W06000021: "monmouthshire",
  W06000022: "newport",
  W06000023: "powys",
  W06000024: "merthyr-tydfil",
};

const fold = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export type PostcodeResult =
  | { ok: false; reason: "invalid" | "notFound" | "notWales" | "unavailable" }
  | { ok: true; postcode: string; councilId: string; onsWard: string | null; wardSlug: string | null; lsoa: string | null; lat: number | null; lng: number | null };

export function normalisePostcode(raw: string): string | null {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/.test(s)) return null;
  return `${s.slice(0, -3)} ${s.slice(-3)}`;
}

export async function lookupPostcode(postcode: string): Promise<PostcodeResult> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("reference");
  let data: { result?: { country?: string; admin_ward?: string; admin_district?: string; latitude?: number | null; longitude?: number | null; codes?: { admin_district?: string; lsoa?: string } } };
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, {
      headers: { "user-agent": "OpenCouncil (+https://www.datblygu.cymru)" },
    });
    if (res.status === 404) return { ok: false, reason: "notFound" };
    if (!res.ok) return { ok: false, reason: "unavailable" };
    data = await res.json();
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  const r = data.result;
  if (!r) return { ok: false, reason: "notFound" };
  if (r.country !== "Wales") return { ok: false, reason: "notWales" };
  const councilId =
    ONS[r.codes?.admin_district ?? ""] ??
    COUNCILS.find((c) => fold(c.nameEn).includes(fold(r.admin_district ?? "")) || fold(c.shortEn) === fold(r.admin_district ?? ""))?.id;
  if (!councilId) return { ok: false, reason: "notFound" };

  // Match the ONS ward to one of the council's wards by name.
  let wardSlug: string | null = null;
  if (r.admin_ward) {
    const wards = await rows<{ slug: string; nameEn: string }>(
      sql`select slug, name_en as "nameEn" from wards where council_id = ${councilId}`,
    );
    const target = fold(r.admin_ward);
    const exact = wards.filter((w) => fold(w.nameEn) === target);
    const loose = wards.filter((w) => fold(w.nameEn).includes(target) || target.includes(fold(w.nameEn)));
    const pick = exact.length === 1 ? exact : loose.length === 1 ? loose : [];
    wardSlug = pick[0]?.slug ?? null;
  }
  return { ok: true, postcode, councilId, onsWard: r.admin_ward ?? null, wardSlug, lsoa: r.codes?.lsoa ?? null, lat: r.latitude ?? null, lng: r.longitude ?? null };
}

/** A council's ONS code from its OpenCouncil id. */
export function onsCodeFor(councilId: string): string | null {
  return Object.entries(ONS).find(([, id]) => id === councilId)?.[0] ?? null;
}

/** One council a postcode sits in, with its ward (or county division) there. */
export type PostcodeCouncil = { councilId: string; onsWard: string | null; wardSlug: string | null };

export type UkPostcodeResult =
  | { ok: false; reason: "invalid" | "notFound" | "unavailable" | "noCouncil" }
  | { ok: true; postcode: string; councils: PostcodeCouncil[] };

async function matchWard(councilId: string, name: string | null | undefined): Promise<string | null> {
  if (!name) return null;
  const wards = await rows<{ slug: string; nameEn: string }>(sql`select slug, name_en as "nameEn" from wards where council_id = ${councilId}`);
  const target = fold(name);
  const exact = wards.filter((w) => fold(w.nameEn) === target);
  const loose = wards.filter((w) => fold(w.nameEn).includes(target) || target.includes(fold(w.nameEn)));
  const pick = exact.length === 1 ? exact : loose.length === 1 ? loose : [];
  return pick[0]?.slug ?? null;
}

/**
 * Any UK postcode to the councils it sits in: the local council, and in two-tier England the county council too,
 * matched by the ONS codes in the council register. A ward is matched only when the names agree.
 */
export async function lookupPostcodeUk(postcode: string): Promise<UkPostcodeResult> {
  "use cache";
  cacheLife("pipeline");
  cacheTag("reference", "councillors");
  type Reply = {
    result?: {
      admin_ward?: string | null;
      admin_district?: string | null;
      ced?: string | null;
      codes?: { admin_district?: string; admin_county?: string };
    };
  };
  let data: Reply;
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`, {
      headers: { "user-agent": "OpenCouncils (+https://opencouncils.com)" },
    });
    if (res.status === 404) return { ok: false, reason: "notFound" };
    if (!res.ok) return { ok: false, reason: "unavailable" };
    data = await res.json();
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  const r = data.result;
  if (!r) return { ok: false, reason: "notFound" };
  const byGss = (code: string | undefined) => (code ? CURRENT_COUNCILS.find((c) => c.gss === code) : undefined);
  const local = byGss(r.codes?.admin_district);
  const county = byGss(r.codes?.admin_county);
  const councils: PostcodeCouncil[] = [];
  if (local) councils.push({ councilId: local.id, onsWard: r.admin_ward ?? null, wardSlug: await matchWard(local.id, r.admin_ward) });
  if (county && county.id !== local?.id) councils.push({ councilId: county.id, onsWard: r.ced ?? null, wardSlug: await matchWard(county.id, r.ced) });
  if (!councils.length) return { ok: false, reason: "noCouncil" };
  return { ok: true, postcode, councils };
}
