-- Company contact info (run after schema-v4)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address_line1 TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address_line2 TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address_city TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address_state TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address_zip TEXT;
