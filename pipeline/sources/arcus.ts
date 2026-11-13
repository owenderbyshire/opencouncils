/**
 * Arcus public registers (Salesforce Experience sites) used by Anglesey,
 * Wrexham and Carmarthenshire. Their pages load records through Salesforce's
 * own API, which also answers anonymous visitors: object information, and a
 * GraphQL query over the planning application object
 * (arcusbuiltenv__Planning_Application__c) that can filter by date. Each site
 * gives its framework version and app token in the URL of its bootstrap
 * script; requests must quote them back.
 */

export const ARCUS_OBJECT = "arcusbuiltenv__Planning_Application__c";

/** The fields read, where a site exposes them. Name is the reference. */
export const ARCUS_FIELDS = [
  "Name",
  "LastModifiedDate",
  "arcusbuiltenv__Site_Address__c",
  "arcusbuiltenv__Proposal__c",
  "arcusbuiltenv__Status__c",
  "arcusbuiltenv__Type__c",
  "arcusbuiltenv__Received_Date__c",
  "arcusbuiltenv__Valid_Date__c",
  "arcusbuiltenv__Validated_Date__c",
  "arcusbuiltenv__Current_Decision__c",
  "arcusbuiltenv__Current_Decision_Date_Formula__c",
  "arcusbuiltenv__Determination_Level__c",
  "arcusbuiltenv__Wards__c",
  "arcusbuiltenv__Date_of_Committee__c",
] as const;

export interface AuraContext {
  mode: string;
  fwuid: string;
  app: string;
  loaded: Record<string, string>;
  dn: string[];
  globals: Record<string, never>;
  uad: boolean;
}

/** The framework version and app token from a site page's script URLs. */
export function auraContext(html: string): AuraContext | null {
  for (const m of html.matchAll(/\/s\/sfsites\/l\/(%7B[^/"]+%7D)\/(?:inline|bootstrap)\.js/g)) {
    try {
      const c = JSON.parse(decodeURIComponent(m[1])) as { mode?: string; fwuid?: string; app?: string; loaded?: Record<string, string> };
      if (c.fwuid && c.app && c.loaded) return { mode: c.mode ?? "PROD", fwuid: c.fwuid, app: c.app, loaded: c.loaded, dn: [], globals: {}, uad: false };
    } catch {
      // Try the next script.
    }
  }
  return null;
}

export interface AuraAction {
  descriptor: string;
  params: Record<string, unknown>;
}

/** The form body of an Aura request, as the site's own pages send it. */
export function auraBody(ctx: AuraContext, pageUri: string, actions: AuraAction[]): string {
  const message = { actions: actions.map((a, i) => ({ id: `${i + 1};a`, descriptor: a.descriptor, callingDescriptor: "UNKNOWN", params: a.params })) };
  return new URLSearchParams({ message: JSON.stringify(message), "aura.context": JSON.stringify(ctx), "aura.pageURI": pageUri, "aura.token": "null" }).toString();
}

export interface AuraReply {
  actions?: Array<{ id: string; state: string; returnValue: unknown; error?: unknown }>;
}

/** The GraphQL query for applications matching `where`, a page at a time. */
export function arcusQuery(fields: readonly string[], where: string, after: string | null): string {
  const cols = fields.map((f) => `${f} { value displayValue }`).join(" ");
  return `query apps { uiapi { query { ${ARCUS_OBJECT}(where: ${where}, first: 200${after ? `, after: "${after}"` : ""}, orderBy: { Name: { order: ASC } }) { pageInfo { hasNextPage endCursor } edges { node { Id ${cols} } } } } } }`;
}

/** A GraphQL "where" for a date field on or after a day. */
export function onOrAfter(field: string, day: string, dateTime = false): string {
  return `{ ${field}: { gte: { value: "${dateTime ? `${day}T00:00:00Z` : day}" } } }`;
}

type Cell = { value: unknown; displayValue: string | null } | undefined;

export interface ArcusRecord {
  id: string;
  reference: string;
  address: string | null;
  proposal: string | null;
  status: string | null;
  type: string | null;
  received: string | null;
  valid: string | null;
  decision: string | null;
  decided: string | null;
  level: string | null;
  ward: string | null;
  committee: string | null;
}

const str = (c: Cell) => (typeof c?.value === "string" && c.value.trim() ? c.value.trim() : null);
const shown = (c: Cell) => (c?.displayValue?.trim() ? c.displayValue.trim() : str(c));
const day = (c: Cell) => {
  const v = str(c);
  return v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
};

/** The records in a GraphQL reply, and the cursor for the next page. */
export function arcusRecords(returnValue: unknown): { records: ArcusRecord[]; next: string | null; errors: string[] } {
  const rv = returnValue as {
    data?: { uiapi?: { query?: Record<string, { pageInfo?: { hasNextPage?: boolean; endCursor?: string }; edges?: Array<{ node: Record<string, Cell> & { Id: string } }> }> } };
    errors?: Array<{ message: string }>;
  };
  const q = rv?.data?.uiapi?.query?.[ARCUS_OBJECT];
  const records: ArcusRecord[] = [];
  for (const { node: n } of q?.edges ?? []) {
    const reference = str(n.Name);
    if (!reference) continue;
    records.push({
      id: n.Id,
      reference,
      address: str(n.arcusbuiltenv__Site_Address__c),
      proposal: str(n.arcusbuiltenv__Proposal__c),
      status: shown(n.arcusbuiltenv__Status__c),
      type: shown(n.arcusbuiltenv__Type__c),
      received: day(n.arcusbuiltenv__Received_Date__c),
      valid: day(n.arcusbuiltenv__Valid_Date__c) ?? day(n.arcusbuiltenv__Validated_Date__c),
      decision: str(n.arcusbuiltenv__Current_Decision__c),
      decided: day(n.arcusbuiltenv__Current_Decision_Date_Formula__c),
      level: shown(n.arcusbuiltenv__Determination_Level__c),
      ward: shown(n.arcusbuiltenv__Wards__c),
      committee: day(n.arcusbuiltenv__Date_of_Committee__c),
    });
  }
  return { records, next: q?.pageInfo?.hasNextPage ? (q.pageInfo.endCursor ?? null) : null, errors: (rv?.errors ?? []).map((e) => e.message) };
}
