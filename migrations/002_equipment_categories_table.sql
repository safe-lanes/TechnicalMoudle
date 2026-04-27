-- Migration: 002_equipment_categories_table
-- Description: Creates the equipment_categories table for admin-managed equipment categorization

CREATE TABLE IF NOT EXISTS equipment_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
