-- EquipForge: enable RLS on public tables (no permissive policies)
-- Run once in Supabase → SQL Editor.
--
-- Why: anon/authenticated clients must not read/write tables via PostgREST.
-- This app uses the service role on the Express server (bypasses RLS).
-- With RLS enabled and no policies, the browser anon key cannot access table data.

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_request_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calibration_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sign_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

-- Optional verification (should show rowsecurity = true for each):
-- SELECT relname, relrowsecurity
-- FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND relname IN (
--     'companies','subscription_limits','profiles','profile_access','equipment_types',
--     'departments','equipment','checkouts','app_notifications','equipment_requests',
--     'equipment_request_lines','subscription_orders','calibration_records','sign_outs',
--     'site_access','app_users','sites','usage'
--   )
-- ORDER BY relname;
