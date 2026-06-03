-- Migration 116: Dual Frequency maintenance basis support
-- Adds interval_running_hour to fleet_jobs (D4) and dual_trigger_leg to work_orders (D5)

-- B1.1: fleet_jobs needs interval_running_hour for Dual Frequency jobs at fleet level
ALTER TABLE fleet_jobs ADD COLUMN IF NOT EXISTS interval_running_hour INTEGER;

-- B1.2: work_orders needs dual_trigger_leg to record which leg triggered WO generation
-- Values: 'CALENDAR' | 'RH' | NULL (NULL = non-dual WO)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS dual_trigger_leg TEXT;
