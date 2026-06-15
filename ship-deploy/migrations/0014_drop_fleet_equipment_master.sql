-- Migration: Drop fleet_equipment_master table
-- This table is unused and replaced by fleet_components table
-- All fleet equipment references now go through fleet_components

DROP TABLE IF EXISTS fleet_equipment_master;
