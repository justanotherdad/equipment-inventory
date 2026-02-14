-- Equipment Inventory - Supabase/PostgreSQL Schema
-- Run this in Supabase SQL Editor after creating your project

-- Equipment types (categories)
CREATE TABLE IF NOT EXISTS equipment_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  requires_calibration BOOLEAN NOT NULL DEFAULT true,
  calibration_frequency_months INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Equipment items
CREATE TABLE IF NOT EXISTS equipment (
  id SERIAL PRIMARY KEY,
  equipment_type_id INTEGER NOT NULL REFERENCES equipment_types(id),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  serial_number TEXT NOT NULL,
  equipment_number TEXT UNIQUE,
  last_calibration_date DATE,
  next_calibration_due DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sign-outs
CREATE TABLE IF NOT EXISTS sign_outs (
  id SERIAL PRIMARY KEY,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id),
  signed_out_by TEXT NOT NULL,
  signed_out_at TIMESTAMPTZ NOT NULL,
  signed_in_by TEXT,
  signed_in_at TIMESTAMPTZ,
  purpose TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage (equipment used on systems during sign-out)
CREATE TABLE IF NOT EXISTS usage (
  id SERIAL PRIMARY KEY,
  sign_out_id INTEGER NOT NULL REFERENCES sign_outs(id),
  system_equipment TEXT NOT NULL,
  notes TEXT
);

-- Calibration records (file_name + storage_path in Supabase Storage)
CREATE TABLE IF NOT EXISTS calibration_records (
  id SERIAL PRIMARY KEY,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(equipment_type_id);
CREATE INDEX IF NOT EXISTS idx_sign_outs_equipment ON sign_outs(equipment_id);
CREATE INDEX IF NOT EXISTS idx_sign_outs_active ON sign_outs(signed_in_at);
CREATE INDEX IF NOT EXISTS idx_usage_sign_out ON usage(sign_out_id);
CREATE INDEX IF NOT EXISTS idx_cal_records_equipment ON calibration_records(equipment_id);

-- Seed default equipment types
INSERT INTO equipment_types (name, requires_calibration, calibration_frequency_months)
VALUES
  ('Temperature Logger', true, 12),
  ('Temp & Humidity Logger', true, 12),
  ('Laptop', false, NULL),
  ('Temperature Block', true, 12),
  ('Temperature Standard', true, 12)
ON CONFLICT (name) DO NOTHING;
