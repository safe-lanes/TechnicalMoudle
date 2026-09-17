-- 133: give work_order_postponements.id a UUID default so ship-created rows are
-- globally unique even if a future insert omits id (today's inserts supply
-- pp-<wo>-<ts> / crypto.randomUUID app-side — this is the defensive DB guarantee).
-- Additive + idempotent: SET DEFAULT is re-runnable; existing rows keep their ids;
-- the default applies only to future inserts that omit id. No data change.
ALTER TABLE work_order_postponements ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
