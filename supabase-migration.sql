-- EquipForge migration: equipment images + calibration sign-out type
-- Run this in your Supabase SQL editor (Database → SQL Editor → New query)

-- 1. Equipment image storage path
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS image_path text;

-- 2. Sign-out type & calibration vendor on sign_outs
ALTER TABLE sign_outs ADD COLUMN IF NOT EXISTS sign_out_type text NOT NULL DEFAULT 'field_use';
ALTER TABLE sign_outs ADD COLUMN IF NOT EXISTS cal_vendor text;

-- 3. Same columns on checkouts (batch sign-out parent record)
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS sign_out_type text NOT NULL DEFAULT 'field_use';
ALTER TABLE checkouts ADD COLUMN IF NOT EXISTS cal_vendor text;

-- Done. No data backfill needed — existing rows default to 'field_use'.
