-- 139: RH accuracy enhancement (Jeevan functional requirement).
--
-- R1: wo_completion_rh — the RH reading AT work completion (Section B2.1
--     "WO Completion RH"). The next RH maintenance cycle (lastDoneRH/nextDueRH/
--     nextDueReading and RH missed-cycles) calculates from THIS value; the
--     Section B3 Current Reading remains only for updating the equipment's
--     latest RH record. Fallback chain (wo_completion_rh ?? current reading)
--     reproduces old behaviour exactly for historical/in-flight WOs — no
--     historical recalculation.
-- R2: current_reading_date — the date the Current Reading was actually taken
--     (Section B3). Threads into the RH module's dateUpdated so components.
--     last_updated / running_hours_audit reflect the reading date, not the WO
--     completion date.
--
-- Additive only; work_orders is BOTH_EDITABLE synced — new columns field-log
-- automatically; old-ship skew safe (unknown-column grace since d8e88c679).
-- Idempotent: IF NOT EXISTS, re-run = clean no-op.
-- (NOTE: number 139 had three design-time claimants — this build committed
-- first; Task #324 and the Shipskart b2b link tables renumber to the next free.)

ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS wo_completion_rh DECIMAL(10,2);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS current_reading_date TEXT;
