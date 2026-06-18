-- Migration 122: Audit identity (Phase 0) — frozen actor display on running-hours audit
-- Adds actor_label to running_hours_audit so each RH change stores the human-readable actor
-- (Office: person name, Ship: rank) captured AT WRITE TIME, surviving crew changes and never
-- resolved live. user_id keeps the canonical id; actor_label is the report-facing label.
--
-- Additive only: nullable, no default. Existing rows keep NULL. Idempotent re-run = no-op.
-- running_hours_audit is BOTH_EDITABLE: an additive nullable column is picked up by full-row
-- sync automatically and does NOT change sync infrastructure or its category.
ALTER TABLE running_hours_audit ADD COLUMN IF NOT EXISTS actor_label TEXT;
