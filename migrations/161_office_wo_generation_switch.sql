-- 161: Office WO generation kill switch + job tracking rebaseline stamp + WO origin marker
-- (Task: fix office work-order generation using stale job data)
--
-- office_wo_generation_enabled: per-vessel opt-in for the shore daily sweep / office
--   generation entry points. Default FALSE for every vessel (fail closed).
-- tracking_rebaselined_at: authorized-rebaseline stamp on jobs/job_component_links —
--   the one-way applier lets shore tracking values through ONLY when the incoming
--   stamp is newer than the local one (admin rebaseline), otherwise ship-owned
--   tracking columns are preserved.
-- generated_by_instance: explicit origin marker on work_orders so office-generated
--   rows are identifiable without relying on sync_field_log insert history.
ALTER TABLE "pms_vessel_settings" ADD COLUMN IF NOT EXISTS "office_wo_generation_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "tracking_rebaselined_at" timestamptz;
ALTER TABLE "job_component_links" ADD COLUMN IF NOT EXISTS "tracking_rebaselined_at" timestamptz;
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "generated_by_instance" text;
