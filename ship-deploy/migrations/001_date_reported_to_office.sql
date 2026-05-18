-- Migration: 001_date_reported_to_office
-- Description: Adds the date_reported_to_office column to the defects table for tracking when defects are reported to office

ALTER TABLE defects ADD COLUMN IF NOT EXISTS date_reported_to_office TEXT;
