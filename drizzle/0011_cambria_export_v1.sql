-- Read-only export for OpenEconomy, version 1.
--
-- OpenEconomy (Datblygu Cymru's economic observatory) shows commercial and
-- industrial planning applications on its council pages. OpenCouncil owns
-- planning applications, so OpenEconomy reads them from here rather than fetching
-- them again (Owen's decision, 2 November 2026). It reads only these views,
-- through its own login, never the tables. The views are a contract: never
-- change their columns; add cambria_v2 instead.

CREATE SCHEMA IF NOT EXISTS cambria_v1;--> statement-breakpoint
COMMENT ON SCHEMA cambria_v1 IS 'Read-only export for OpenEconomy, version 1. Do not change; add cambria_v2 instead.';--> statement-breakpoint

-- Every planning application OpenCouncil holds, as the register publishes it.
CREATE OR REPLACE VIEW cambria_v1.planning_applications AS
  SELECT name, authority, reference, address, postcode, description,
         app_type, app_state, app_size,
         start_date::text AS start_date, consulted_date::text AS consulted_date,
         decided_date::text AS decided_date, target_date::text AS target_date,
         decision, decided_by, ward, homes, lat, lng, url, docs_url,
         council_id, meeting_id, agenda_item_id,
         last_changed, updated_at
  FROM public.planning_applications;--> statement-breakpoint

-- OpenEconomy's login (cambria_reader) exists only in production. Elsewhere this does nothing.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cambria_reader') THEN
    GRANT USAGE ON SCHEMA cambria_v1 TO cambria_reader;
    GRANT SELECT ON ALL TABLES IN SCHEMA cambria_v1 TO cambria_reader;
  END IF;
END $$;
