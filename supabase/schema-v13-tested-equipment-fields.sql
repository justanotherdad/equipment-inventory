-- EquipForge: store the system under test on requests and sign-outs.
-- Run once in Supabase → SQL Editor.
--
-- Request Equipment writes these when the form includes an equipment type
-- or system number. Without the columns, that insert fails.

ALTER TABLE public.equipment_requests ADD COLUMN IF NOT EXISTS tested_equipment_type text;
ALTER TABLE public.equipment_requests ADD COLUMN IF NOT EXISTS system_number text;
ALTER TABLE public.sign_outs ADD COLUMN IF NOT EXISTS tested_equipment_type text;
ALTER TABLE public.sign_outs ADD COLUMN IF NOT EXISTS system_number text;

NOTIFY pgrst, 'reload schema';
