-- Read-only export for OpenEconomy, version 1: council records.
--
-- OpenCharity (Datblygu Cymru) shows, on each charity's page, council
-- business that names the charity: agenda items and decisions, reports, and
-- councillors' declarations of interest (Owen's decision, 4 November 2026).
-- OpenEconomy reads these views through its own login (cambria_reader) and does
-- the name matching itself. Adding views to cambria_v1 leaves the existing
-- planning_applications view untouched. Never change these columns; add
-- cambria_v2 instead. No councillor contact details are exposed.

-- Every agenda item, with its meeting, committee and any recorded decision.
CREATE OR REPLACE VIEW cambria_v1.agenda_items AS
  SELECT a.council_id, a.meeting_id, a.id AS agenda_item_id,
         m.date::text AS meeting_date, m.cancelled,
         m.committee_id, c.name_en AS committee_en, c.name_cy AS committee_cy, c.kind AS committee_kind,
         a.number, a.title, a.is_decision, a.is_restricted,
         a.agenda_text, a.minutes, d.text AS decision
  FROM public.agenda_items a
  JOIN public.meetings m ON m.council_id = a.council_id AND m.id = a.meeting_id
  LEFT JOIN public.committees c ON c.council_id = m.council_id AND c.id = m.committee_id
  LEFT JOIN public.decisions d ON d.council_id = a.council_id AND d.agenda_item_id = a.id;--> statement-breakpoint

-- Reports and other documents attached to meetings, by title (no extracted text).
CREATE OR REPLACE VIEW cambria_v1.documents AS
  SELECT d.council_id, d.meeting_id, d.agenda_item_id, d.id AS document_id,
         m.date::text AS meeting_date, d.title, d.url, d.published::text AS published
  FROM public.documents d
  JOIN public.meetings m ON m.council_id = d.council_id AND m.id = d.meeting_id;--> statement-breakpoint

-- Declarations of interest as the minutes record them, with the councillor's name where it was matched.
CREATE OR REPLACE VIEW cambria_v1.declarations AS
  SELECT x.council_id, x.meeting_id, m.date::text AS meeting_date,
         c.name_en AS committee_en, c.name_cy AS committee_cy,
         x.councillor_id, k.name AS councillor_name, x.name_as_recorded,
         x.agenda_item_id, coalesce(a.title, x.item_as_recorded) AS item_title,
         x.kind, x.nature_en, x.nature_cy
  FROM public.declarations x
  JOIN public.meetings m ON m.council_id = x.council_id AND m.id = x.meeting_id
  LEFT JOIN public.committees c ON c.council_id = m.council_id AND c.id = m.committee_id
  LEFT JOIN public.councillors k ON k.council_id = x.council_id AND k.id = x.councillor_id
  LEFT JOIN public.agenda_items a ON a.council_id = x.council_id AND a.id = x.agenda_item_id;--> statement-breakpoint

-- OpenEconomy's login (cambria_reader) exists only in production. Elsewhere this does nothing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cambria_reader') THEN
    GRANT USAGE ON SCHEMA cambria_v1 TO cambria_reader;
    GRANT SELECT ON ALL TABLES IN SCHEMA cambria_v1 TO cambria_reader;
  END IF;
END $$;
