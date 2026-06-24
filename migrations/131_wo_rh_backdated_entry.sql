-- Add rh_backdated_entry flag to work_orders
-- Set to TRUE when a WO completion RH reading is back-dated (older date AND lower value
-- than the component's current RH state). The RH module is NOT updated in this case;
-- the reading is saved to the WO only for job scheduling / next-due calculation.
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS rh_backdated_entry BOOLEAN;
