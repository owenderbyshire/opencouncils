/**
 * OpenCouncil database schema.
 *
 * Conventions
 * - Every table that holds council data starts with `council_id`, the
 *   council's slug ("cardiff"). Upstream IDs are only unique within one
 *   council's ModernGov site, so primary keys are (council_id, upstream id).
 *   That lets all 22 councils share one database and one search index later.
 * - Upstream identifiers are kept wherever ModernGov provides a stable one
 *   (councillor UIDs, committee IDs, meeting IDs, agenda item IDs, document
 *   attachment IDs), so the pipeline can upsert idempotently and every row can
 *   be traced to its source page.
 * - Facts shown on the site come from the council's own records. AI-written
 *   text lives only in `summaries` (and `declarations` rows whose `source` is
 *   'minutes-ai'), and always links to the documents it was written from.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/* -------------------------------------------------------------------------- */
/* Councils and wards                                                          */
/* -------------------------------------------------------------------------- */

/** One row per council. Written by the `seed` job from data/curated/councils.ts. */
export const councils = pgTable("councils", {
  id: text("id").primaryKey(), // slug: cardiff, swansea, rhondda-cynon-taf...
  nameEn: text("name_en").notNull(),
  nameCy: text("name_cy").notNull(),
  /** Base of the council's ModernGov site, without a trailing slash. Null for councils on other systems. */
  moderngovBase: text("moderngov_base"),
  website: text("website"),
  /** Councils switched on in the pipeline and shown on the site. */
  active: boolean("active").notNull().default(false),
});

export const wards = pgTable(
  "wards",
  {
    councilId: text("council_id").notNull(),
    slug: text("slug").notNull(),
    nameEn: text("name_en").notNull(),
    nameCy: text("name_cy"),
    seats: smallint("seats"),
  },
  (t) => [primaryKey({ columns: [t.councilId, t.slug] })],
);

/* -------------------------------------------------------------------------- */
/* Councillors and committees                                                  */
/* -------------------------------------------------------------------------- */

export const councillors = pgTable(
  "councillors",
  {
    councilId: text("council_id").notNull(),
    id: integer("id").notNull(), // ModernGov UID
    name: text("name").notNull(),
    honorific: text("honorific"),
    wardSlug: text("ward_slug"),
    partyLabel: text("party_label"),
    partyId: text("party_id"),
    groupLabel: text("group_label"),
    photoUrl: text("photo_url"),
    email: text("email"),
    phone: text("phone"),
    keyPosts: jsonb("key_posts").$type<string[]>().notNull().default([]),
    termStart: date("term_start", { mode: "string" }),
    /** The councillor's own page on the council's site, where it isn't a ModernGov page (the Vale of Glamorgan). */
    sourceUrl: text("source_url"),
    /** The council's own attendance record, where it publishes one per councillor (the Vale of Glamorgan). */
    officialAttendance: jsonb("official_attendance").$type<{
      period: string | null;
      rows: Array<{ name: string; committeeId: number | null; held: number | null; attended: number | null; apologies: number | null }>;
    }>(),
    /** In the council's current list of councillors. Former councillors keep their rows. */
    current: boolean("current").notNull().default(true),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.councilId, t.id] }),
    index("councillors_ward_idx").on(t.councilId, t.wardSlug),
  ],
);

/**
 * What a committee is, for filtering and for deciding which meetings get a
 * summary: full council, cabinet, scrutiny and planning do.
 */
export type CommitteeKind = "council" | "cabinet" | "scrutiny" | "planning" | "regulatory" | "other";

export const committees = pgTable(
  "committees",
  {
    councilId: text("council_id").notNull(),
    id: integer("id").notNull(), // ModernGov committee ID
    nameEn: text("name_en").notNull(),
    nameCy: text("name_cy"),
    category: text("category"),
    kind: text("kind").$type<CommitteeKind>().notNull().default("other"),
    active: boolean("active").notNull().default(true),
    /** The committee's own page, for councils not on ModernGov. */
    sourceUrl: text("source_url"),
  },
  (t) => [primaryKey({ columns: [t.councilId, t.id] })],
);

export const committeeMembers = pgTable(
  "committee_members",
  {
    councilId: text("council_id").notNull(),
    committeeId: integer("committee_id").notNull(),
    councillorId: integer("councillor_id").notNull(),
    role: text("role").notNull(), // chair | vice-chair | member | substitute
    roleRaw: text("role_raw"),
  },
  (t) => [
    primaryKey({ columns: [t.councilId, t.committeeId, t.councillorId] }),
    index("committee_members_councillor_idx").on(t.councilId, t.councillorId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Meetings                                                                    */
/* -------------------------------------------------------------------------- */

export const meetings = pgTable(
  "meetings",
  {
    councilId: text("council_id").notNull(),
    id: integer("id").notNull(), // ModernGov meeting ID
    committeeId: integer("committee_id").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    startTime: text("start_time"),
    status: text("status"),
    cancelled: boolean("cancelled").notNull().default(false),
    location: text("location"),
    agendaPublished: boolean("agenda_published").notNull().default(false),
    minutesPublished: boolean("minutes_published").notNull().default(false),
    decisionsPublished: boolean("decisions_published").notNull().default(false),
    /** Hash of the last meeting record fetched, so unchanged meetings are skipped. */
    detailHash: text("detail_hash"),
    detailFetchedAt: ts("detail_fetched_at"),
    /** The meeting's own page, for councils not on ModernGov (the Vale of Glamorgan). */
    sourceUrl: text("source_url"),
    /** A recording of the meeting, where the council links one. */
    recordingUrl: text("recording_url"),
  },
  (t) => [
    primaryKey({ columns: [t.councilId, t.id] }),
    index("meetings_date_idx").on(t.councilId, t.date),
    index("meetings_committee_idx").on(t.councilId, t.committeeId, t.date),
  ],
);

export const agendaItems = pgTable(
  "agenda_items",
  {
    councilId: text("council_id").notNull(),
    id: integer("id").notNull(), // ModernGov agenda item ID
    meetingId: integer("meeting_id").notNull(),
    seq: smallint("seq").notNull(),
    number: text("number"),
    title: text("title").notNull(),
    isDecision: boolean("is_decision").notNull().default(false),
    isRestricted: boolean("is_restricted").notNull().default(false),
    declarationCount: smallint("declaration_count").notNull().default(0),
    /** The agenda's own description of the item, as plain text. */
    agendaText: text("agenda_text"),
    /** The minute for this item as plain text, once the council publishes minutes. */
    minutes: text("minutes"),
  },
  (t) => [
    primaryKey({ columns: [t.councilId, t.id] }),
    index("agenda_items_meeting_idx").on(t.councilId, t.meetingId, t.seq),
  ],
);

export const documents = pgTable(
  "documents",
  {
    councilId: text("council_id").notNull(),
    id: integer("id").notNull(), // ModernGov attachment ID
    meetingId: integer("meeting_id").notNull(),
    agendaItemId: integer("agenda_item_id"),
    title: text("title").notNull(),
    url: text("url").notNull(),
    published: date("published", { mode: "string" }),
    isDecisionAttachment: boolean("is_decision_attachment").notNull().default(false),
    /** Extracted text, kept only for meetings that get a summary. */
    text: text("text"),
    pages: smallint("pages"),
  },
  (t) => [
    primaryKey({ columns: [t.councilId, t.id] }),
    index("documents_meeting_idx").on(t.councilId, t.meetingId),
  ],
);

export type AttendanceStatus =
  | "present"
  | "substitute"
  | "apologies"
  | "sent_substitute"
  | "absent"
  | "in_attendance"
  | "other";

export const attendance = pgTable(
  "attendance",
  {
    councilId: text("council_id").notNull(),
    meetingId: integer("meeting_id").notNull(),
    councillorId: integer("councillor_id").notNull(),
    status: text("status").$type<AttendanceStatus>().notNull(),
    statusRaw: text("status_raw"),
    role: text("role"),
  },
  (t) => [
    primaryKey({ columns: [t.councilId, t.meetingId, t.councillorId] }),
    index("attendance_councillor_idx").on(t.councilId, t.councillorId),
  ],
);

/**
 * Decisions as the council recorded them: the "RESOLVED" text of a minute,
 * word for word. Plain-language versions live in `summaries`.
 */
export const decisions = pgTable(
  "decisions",
  {
    id: serial("id").primaryKey(),
    councilId: text("council_id").notNull(),
    meetingId: integer("meeting_id").notNull(),
    agendaItemId: integer("agenda_item_id").notNull(),
    text: text("text").notNull(),
  },
  (t) => [
    uniqueIndex("decisions_item_idx").on(t.councilId, t.agendaItemId),
    index("decisions_meeting_idx").on(t.councilId, t.meetingId),
  ],
);

/**
 * Declarations of interest made at a meeting, read from the minute of the
 * declarations item. `councillorId` is set only when the name matches one
 * councillor of that council exactly.
 */
export const declarations = pgTable(
  "declarations",
  {
    id: serial("id").primaryKey(),
    councilId: text("council_id").notNull(),
    meetingId: integer("meeting_id").notNull(),
    councillorId: integer("councillor_id"),
    nameAsRecorded: text("name_as_recorded").notNull(),
    /** The agenda item the interest relates to, when the minute names one that matches. */
    agendaItemId: integer("agenda_item_id"),
    itemAsRecorded: text("item_as_recorded"),
    kind: text("kind").notNull(), // personal | prejudicial | personal-and-prejudicial | other
    natureEn: text("nature_en"),
    natureCy: text("nature_cy"),
    source: text("source").notNull(), // minutes-ai
  },
  (t) => [
    index("declarations_meeting_idx").on(t.councilId, t.meetingId),
    index("declarations_councillor_idx").on(t.councilId, t.councillorId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Plain-language summaries                                                    */
/* -------------------------------------------------------------------------- */

export const summaries = pgTable(
  "summaries",
  {
    id: serial("id").primaryKey(),
    councilId: text("council_id").notNull(),
    meetingId: integer("meeting_id").notNull(),
    promptVersion: text("prompt_version").notNull(),
    inputHash: text("input_hash").notNull(),
    model: text("model").notNull(),
    content: jsonb("content").notNull(),
    /** What generating it cost, in pence, for the monthly cap. */
    costPence: real("cost_pence"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("summaries_meeting_idx").on(t.councilId, t.meetingId, t.promptVersion)],
);

/* -------------------------------------------------------------------------- */
/* Search                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * One row per agenda item, across every council, rebuilt by the `index` job.
 * Holds what search, topics and feeds need in one place. English text is
 * stemmed; Welsh summaries are indexed word for word.
 */
/**
 * Issues: the same business followed across meetings (pipeline/jobs/issues.ts).
 * Rebuilt each night from the search index, so IDs are stable hashes of the
 * issue's first item.
 */
export const issues = pgTable(
  "issues",
  {
    councilId: text("council_id").notNull(),
    id: integer("id").notNull(),
    titleEn: text("title_en").notNull(),
    titleCy: text("title_cy"),
    firstDate: date("first_date", { mode: "string" }).notNull(),
    lastDate: date("last_date", { mode: "string" }).notNull(),
    steps: smallint("steps").notNull(),
    kinds: text("kinds").array().notNull().default(sql`'{}'::text[]`),
    topics: text("topics").array().notNull().default(sql`'{}'::text[]`),
    /** Whether full Council or Cabinet has recorded a decision on it. */
    decided: boolean("decided").notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.councilId, t.id] }), index("issues_last_idx").on(t.lastDate)],
);

export const issueItems = pgTable(
  "issue_items",
  {
    councilId: text("council_id").notNull(),
    issueId: integer("issue_id").notNull(),
    agendaItemId: integer("agenda_item_id").notNull(),
    meetingId: integer("meeting_id").notNull(),
    date: date("date", { mode: "string" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.councilId, t.agendaItemId] }), index("issue_items_issue_idx").on(t.councilId, t.issueId)],
);

export const searchItems = pgTable(
  "search_items",
  {
    councilId: text("council_id").notNull(),
    agendaItemId: integer("agenda_item_id").notNull(),
    meetingId: integer("meeting_id").notNull(),
    committeeId: integer("committee_id").notNull(),
    committeeKind: text("committee_kind").$type<CommitteeKind>().notNull(),
    date: date("date", { mode: "string" }).notNull(),
    title: text("title").notNull(),
    /** The recorded decision, word for word. */
    decision: text("decision"),
    headlineEn: text("headline_en"),
    headlineCy: text("headline_cy"),
    decidedEn: text("decided_en"),
    decidedCy: text("decided_cy"),
    /** The minute, trimmed, for matching only. */
    body: text("body"),
    topics: text("topics").array().notNull().default(sql`'{}'::text[]`),
    tsv: tsvector("tsv").generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(headline_en, '')), 'A')
        || setweight(to_tsvector('english', coalesce(decided_en, '') || ' ' || coalesce(decision, '')), 'B')
        || setweight(to_tsvector('simple', coalesce(headline_cy, '') || ' ' || coalesce(decided_cy, '')), 'B')
        || setweight(to_tsvector('english', coalesce(body, '')), 'D')`,
    ),
  },
  (t) => [
    primaryKey({ columns: [t.councilId, t.agendaItemId] }),
    index("search_items_tsv_idx").using("gin", t.tsv),
    index("search_items_topics_idx").using("gin", t.topics),
    index("search_items_date_idx").on(t.date),
  ],
);

/* -------------------------------------------------------------------------- */
/* Pipeline bookkeeping                                                        */
/* -------------------------------------------------------------------------- */

export const pipelineRuns = pgTable(
  "pipeline_runs",
  {
    id: serial("id").primaryKey(),
    job: text("job").notNull(),
    startedAt: ts("started_at").notNull().defaultNow(),
    finishedAt: ts("finished_at"),
    status: text("status").notNull().default("running"), // running | ok | partial | failed
    stats: jsonb("stats").$type<Record<string, number | string>>(),
    error: text("error"),
  },
  (t) => [index("pipeline_runs_job_idx").on(t.job, t.startedAt)],
);

/** Small key/value store for pipeline cursors. */
export const pipelineState = pgTable("pipeline_state", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* -------------------------------------------------------------------------- */
/* Weekly email                                                                */
/* -------------------------------------------------------------------------- */

/**
 * People who asked for the weekly email. No accounts: an address is added as
 * "pending" with the choices it asked for, and those choices take effect only
 * when the link in the confirmation email is followed.
 */
export const subscribers = pgTable(
  "subscribers",
  {
    id: text("id").primaryKey(), // random UUID, used in signed links
    email: text("email").notNull(),
    lang: text("lang").notNull().default("en"),
    status: text("status").notNull().default("pending"), // pending | active | stopped
    councils: text("councils").array().notNull().default(sql`'{}'::text[]`),
    topics: text("topics").array().notNull().default(sql`'{}'::text[]`),
    /** Choices waiting for confirmation. */
    pendingCouncils: text("pending_councils").array(),
    pendingTopics: text("pending_topics").array(),
    /** Planning applications within a kilometre of this postcode, if asked for. */
    postcode: text("postcode"),
    lat: real("lat"),
    lng: real("lng"),
    pendingPostcode: text("pending_postcode"),
    pendingLat: real("pending_lat"),
    pendingLng: real("pending_lng"),
    pendingLang: text("pending_lang"),
    /** Words or street names to watch for in agendas, minutes and planning applications. */
    keywords: text("keywords").array().notNull().default(sql`'{}'::text[]`),
    pendingKeywords: text("pending_keywords").array(),
    /** Also email as soon as something matches, as well as the weekly round-up. */
    instant: boolean("instant").notNull().default(false),
    pendingInstant: boolean("pending_instant"),
    confirmSentAt: ts("confirm_sent_at"),
    confirmedAt: ts("confirmed_at"),
    digestSentAt: ts("digest_sent_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("subscribers_email_idx").on(t.email)],
);

/** What each reader has already been sent an instant alert about, so nothing is sent twice. */
export const alertLog = pgTable(
  "alert_log",
  {
    subscriberId: text("subscriber_id").notNull(),
    /** For example "item:cardiff:123:agenda", "item:cardiff:123:decided", "plan:456:new". */
    key: text("key").notNull(),
    sentAt: ts("sent_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.subscriberId, t.key] })],
);

/* -------------------------------------------------------------------------- */
/* Planning applications                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Planning applications for Wales's 25 planning authorities, collected by UK
 * PlanIt from each authority's own register (pipeline/jobs/planning.ts).
 * `name` is PlanIt's unique key ("Cardiff/26/01234/FUL"). When an
 * application appears on a planning committee agenda, the item is linked.
 */
export const planningApplications = pgTable(
  "planning_applications",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    authority: text("authority").notNull(),
    reference: text("reference"),
    address: text("address"),
    postcode: text("postcode"),
    description: text("description"),
    appType: text("app_type"),
    appState: text("app_state"),
    appSize: text("app_size"),
    startDate: date("start_date", { mode: "string" }),
    consultedDate: date("consulted_date", { mode: "string" }),
    decidedDate: date("decided_date", { mode: "string" }),
    targetDate: date("target_date", { mode: "string" }),
    decision: text("decision"),
    decidedBy: text("decided_by"),
    ward: text("ward"),
    homes: integer("homes"),
    lat: real("lat"),
    lng: real("lng"),
    url: text("url"),
    docsUrl: text("docs_url"),
    commentUrl: text("comment_url"),
    planitLink: text("planit_link"),
    lastChanged: ts("last_changed"),
    /** The planning committee item that considered it, when one names its reference. */
    councilId: text("council_id"),
    meetingId: integer("meeting_id"),
    agendaItemId: integer("agenda_item_id"),
    firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("planning_name_idx").on(t.name),
    index("planning_authority_idx").on(t.authority, t.startDate),
    index("planning_location_idx").on(t.lat, t.lng),
    index("planning_meeting_idx").on(t.councilId, t.meetingId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Consultations                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Open (and recently closed) public consultations: each council's own, and
 * the Welsh Government's. `councilId` is null for the Welsh Government.
 */
export const consultations = pgTable(
  "consultations",
  {
    /** The English page's URL. */
    url: text("url").primaryKey(),
    /** "gov" for the Welsh Government, otherwise the council's id. */
    source: text("source").notNull(),
    councilId: text("council_id"),
    typeEn: text("type_en"),
    titleEn: text("title_en").notNull(),
    titleCy: text("title_cy"),
    urlCy: text("url_cy"),
    summaryEn: text("summary_en"),
    summaryCy: text("summary_cy"),
    area: text("area"),
    opens: date("opens", { mode: "string" }),
    closes: date("closes", { mode: "string" }),
    /** False once the source stops listing it as open. */
    open: boolean("open").notNull().default(true),
    topics: text("topics").array().notNull().default(sql`'{}'::text[]`),
    firstSeen: ts("first_seen").notNull().defaultNow(),
    fetchedAt: ts("fetched_at").notNull().defaultNow(),
  },
  (t) => [index("consultations_closes_idx").on(t.closes), index("consultations_council_idx").on(t.councilId, t.open)],
);

/* -------------------------------------------------------------------------- */
/* Local Development Plans                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Each LDP document read (data/curated/ldps.ts): the adopted written
 * statement, a replacement plan's deposit version, and the latest Annual
 * Monitoring Report. `kind` is "adopted", "deposit" or "amr"; `url` is one
 * file, so a statement split into several PDFs has several rows.
 */
export const ldpDocuments = pgTable(
  "ldp_documents",
  {
    id: serial("id").primaryKey(),
    authority: text("authority").notNull(),
    kind: text("kind").notNull(),
    url: text("url").notNull(),
    hash: text("hash"),
    pageCount: integer("page_count"),
    /** Bumped when the reading changes, so documents are read again. */
    readVersion: integer("read_version"),
    /** The same for the plain-language summary. */
    summaryVersion: integer("summary_version"),
    costPence: real("cost_pence").notNull().default(0),
    problem: text("problem"),
    fetchedAt: ts("fetched_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ldp_documents_url_idx").on(t.authority, t.kind, t.url)],
);

/** A headline figure read from an LDP document, with the page and words it rests on. */
export const ldpFacts = pgTable(
  "ldp_facts",
  {
    id: serial("id").primaryKey(),
    authority: text("authority").notNull(),
    kind: text("kind").notNull(),
    key: text("key").notNull(),
    value: doublePrecision("value").notNull(),
    url: text("url").notNull(),
    page: integer("page").notNull(),
    quote: text("quote").notNull(),
    /** Pages giving the same figure. */
    mentions: integer("mentions").notNull().default(1),
  },
  (t) => [index("ldp_facts_authority_idx").on(t.authority, t.kind)],
);

/** A site an LDP allocates for development, as the plan lists it. */
export const ldpSites = pgTable(
  "ldp_sites",
  {
    id: serial("id").primaryKey(),
    authority: text("authority").notNull(),
    kind: text("kind").notNull(),
    ref: text("ref"),
    name: text("name").notNull(),
    settlement: text("settlement"),
    use: text("use").notNull(),
    homes: integer("homes"),
    hectares: doublePrecision("hectares"),
    url: text("url").notNull(),
    page: integer("page").notNull(),
    quote: text("quote").notNull(),
  },
  (t) => [index("ldp_sites_authority_idx").on(t.authority, t.kind)],
);

/**
 * A plain-language point about what an LDP says on one topic, resting on a
 * policy and the words on the page it cites.
 */
export const ldpPoints = pgTable(
  "ldp_points",
  {
    id: serial("id").primaryKey(),
    authority: text("authority").notNull(),
    kind: text("kind").notNull(),
    topic: text("topic").notNull(),
    seq: integer("seq").notNull(),
    textEn: text("text_en").notNull(),
    textCy: text("text_cy").notNull(),
    /** The plan's policy reference, such as "SP1" or "H2". */
    policy: text("policy"),
    url: text("url").notNull(),
    page: integer("page").notNull(),
    quote: text("quote").notNull(),
  },
  (t) => [index("ldp_points_authority_idx").on(t.authority, t.kind)],
);

/** An allocated site's boundary, from an authority's published map data. */
export const ldpAreas = pgTable(
  "ldp_areas",
  {
    id: serial("id").primaryKey(),
    authority: text("authority").notNull(),
    layer: text("layer").notNull(),
    use: text("use").notNull(),
    ref: text("ref"),
    name: text("name"),
    /** GeoJSON geometry in longitude and latitude. */
    geometry: jsonb("geometry").notNull(),
    props: jsonb("props"),
    minLng: doublePrecision("min_lng").notNull(),
    minLat: doublePrecision("min_lat").notNull(),
    maxLng: doublePrecision("max_lng").notNull(),
    maxLat: doublePrecision("max_lat").notNull(),
  },
  (t) => [index("ldp_areas_authority_idx").on(t.authority)],
);

/** A planning application whose location falls inside an allocated site. */
export const ldpAreaApplications = pgTable(
  "ldp_area_applications",
  {
    areaId: integer("area_id").notNull(),
    application: text("application").notNull(),
  },
  (t) => [primaryKey({ columns: [t.areaId, t.application] }), index("ldp_area_app_idx").on(t.application)],
);

/**
 * A monthly overview of a topic across Wales's councils: what's happening,
 * the pressing issues and the policy context, each point resting on cited
 * sources (council records held here, or official web pages). Written by
 * pipeline/jobs/topic-briefs.ts; the latest per topic is shown.
 */
/**
 * Checked facts from a council's own papers (pipeline/jobs/council-papers.ts): its latest risk register
 * ("risks"), the report that set the year's budget ("budget") and its latest in-year monitoring ("monitoring").
 * One row per council and kind, replaced when a newer paper is read.
 */
export const councilPapers = pgTable(
  "council_papers",
  {
    councilId: text("council_id").notNull(),
    kind: text("kind").notNull(),
    meetingId: integer("meeting_id").notNull(),
    itemId: integer("item_id"),
    date: date("date", { mode: "string" }).notNull(),
    committee: text("committee").notNull(),
    title: text("title").notNull(),
    /** The papers read: [{ id, title, url }]. */
    documents: jsonb("documents").notNull(),
    content: jsonb("content").notNull(),
    model: text("model").notNull(),
    costPence: real("cost_pence").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.councilId, t.kind] })],
);

/** Monthly overviews of each council (pipeline/jobs/council-briefs.ts): who runs it, its priorities, what to watch. */
export const councilBriefs = pgTable(
  "council_briefs",
  {
    id: serial("id").primaryKey(),
    councilId: text("council_id").notNull(),
    /** The month written, "2026-11". */
    month: text("month").notNull(),
    content: jsonb("content").notNull(),
    model: text("model").notNull(),
    costPence: real("cost_pence").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("council_briefs_council_month_idx").on(t.councilId, t.month)],
);

export const topicBriefs = pgTable(
  "topic_briefs",
  {
    id: serial("id").primaryKey(),
    topic: text("topic").notNull(),
    /** The month written, "2026-11". */
    month: text("month").notNull(),
    content: jsonb("content").notNull(),
    model: text("model").notNull(),
    costPence: real("cost_pence").notNull().default(0),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("topic_briefs_topic_month_idx").on(t.topic, t.month)],
);

/* -------------------------------------------------------------------------- */
/* Who holds what, and what is coming to Cabinet                               */
/* -------------------------------------------------------------------------- */

/**
 * A council's executive posts ("Cabinet Member for Education") and who holds
 * each, from its own executive posts pages (pipeline/jobs/executive-posts.ts).
 * One row per post and holder, so a shared post has a row for each holder and
 * a vacant post has none. Replaced whole each time a council is read. Shown
 * only for councillors the council's committee list puts on its Cabinet.
 */
export const executivePosts = pgTable(
  "executive_posts",
  {
    councilId: text("council_id").notNull(),
    /** The council's own ID for the post (ModernGov); a hash of the title where its page has none. */
    postId: integer("post_id").notNull(),
    councillorId: integer("councillor_id").notNull(),
    /** The post in the council's own words. */
    title: text("title").notNull(),
    /** The council's page that says who holds it. */
    url: text("url").notNull(),
    fetchedAt: ts("fetched_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.councilId, t.postId, t.councillorId] }), index("executive_posts_councillor_idx").on(t.councilId, t.councillorId)],
);

/**
 * Decisions a council has said it plans to take, from its published list of
 * forthcoming decisions (pipeline/jobs/forward-plans.ts). Titles and decision
 * makers are kept in the council's wording. A row stays once the council
 * stops listing it (`listed` false), so a decision that has been taken can
 * link to the meeting where it was.
 */
export const plannedDecisions = pgTable(
  "planned_decisions",
  {
    councilId: text("council_id").notNull(),
    /** The council's own ID for the matter (a ModernGov issue). */
    issueId: integer("issue_id").notNull(),
    title: text("title").notNull(),
    /** What the decision is about, as the council describes it. */
    purpose: text("purpose"),
    /** Who will decide, as published: "Cabinet", or several bodies in turn. */
    makers: text("makers").notNull().default(""),
    /** Whether the Cabinet, or a Cabinet member, is among them. */
    executive: boolean("executive").notNull().default(false),
    /** When the decision is due: the day, or the first of the month where the council gives only a month. */
    due: date("due", { mode: "string" }),
    dueMonthOnly: boolean("due_month_only").notNull().default(false),
    /** The day it is due at the Cabinet, where the council's page for the matter gives one. */
    executiveDue: date("executive_due", { mode: "string" }),
    /** Whether the council marks it a key decision. Null when its pages don't say. */
    isKey: boolean("is_key"),
    /** "For Determination" and the like, as published. */
    status: text("status"),
    /** The lead member, as the council names the post. Officers' names are not kept. */
    leadMember: text("lead_member"),
    /** The lead director's post, where the council gives one. */
    leadDirector: text("lead_director"),
    /** Whether the council expects to take it in public: "Open", "Fully exempt". */
    restriction: text("restriction"),
    noticePublished: date("notice_published", { mode: "string" }),
    topics: text("topics").array().notNull().default(sql`'{}'::text[]`),
    /** The council's page for the matter. */
    url: text("url").notNull(),
    /** Still on the council's list at the last read. */
    listed: boolean("listed").notNull().default(true),
    firstSeen: ts("first_seen").notNull().defaultNow(),
    lastSeen: ts("last_seen").notNull().defaultNow(),
    /** When the council's page for the matter was last read, and a hash of the list entry it was read for. */
    detailFetchedAt: ts("detail_fetched_at"),
    detailHash: text("detail_hash"),
    /** The agenda item the council's page links for the day it was due, once there is one. */
    takenMeetingId: integer("taken_meeting_id"),
    takenItemId: integer("taken_item_id"),
  },
  (t) => [primaryKey({ columns: [t.councilId, t.issueId] }), index("planned_decisions_due_idx").on(t.due), index("planned_decisions_listed_idx").on(t.councilId, t.listed)],
);

/**
 * When each council's executive posts ("executive-posts") and forthcoming
 * decisions ("forward-plan") were last looked for, and what came back, so the
 * site can say when a council was last read and why another is not shown.
 */
export const sourceReads = pgTable(
  "source_reads",
  {
    councilId: text("council_id").notNull(),
    source: text("source").notNull(),
    /** The last attempt. */
    checkedAt: ts("checked_at").notNull().defaultNow(),
    /** The last time it was read in full. Null if it never has been. */
    readAt: ts("read_at"),
    /**
     * The last attempt's outcome: "ok" (read), "empty" (read, and the council lists nothing there), "robots"
     * (the council's robots.txt closes the page), "challenge" (its site asks automated readers to pass a check,
     * which the pipeline does not attempt), "missing" (no such page), "failed" (no answer, or one that made no sense).
     */
    outcome: text("outcome").notNull(),
    rows: integer("rows").notNull().default(0),
    note: text("note"),
  },
  (t) => [primaryKey({ columns: [t.councilId, t.source] })],
);
