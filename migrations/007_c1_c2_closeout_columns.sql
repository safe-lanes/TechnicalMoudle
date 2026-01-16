-- Add C1 Closeout and C2 Verification columns to defects table

-- C1 Closeout fields
ALTER TABLE defects ADD COLUMN IF NOT EXISTS closed_out_by_name TEXT;
ALTER TABLE defects ADD COLUMN IF NOT EXISTS closed_out_by_rank TEXT;

-- C2 Verification fields
ALTER TABLE defects ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false;
ALTER TABLE defects ADD COLUMN IF NOT EXISTS date_verified TEXT;
ALTER TABLE defects ADD COLUMN IF NOT EXISTS verified_by_name TEXT;
ALTER TABLE defects ADD COLUMN IF NOT EXISTS verified_by_office_position TEXT;
