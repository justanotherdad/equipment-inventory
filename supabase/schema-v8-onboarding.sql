-- Add onboarding_complete to profiles for company admin first-time setup flow
-- Run this migration in Supabase SQL Editor if using Supabase

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;

-- Existing company admins who already have sites can be marked complete
-- (Optional: run after migration if you want to skip onboarding for existing admins)
-- UPDATE profiles SET onboarding_complete = true WHERE role = 'company_admin';
