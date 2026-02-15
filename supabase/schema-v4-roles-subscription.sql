-- Role hierarchy and subscription model
-- Run after schema-v3-auth-access.sql

-- Update profiles.role to new hierarchy: user, equipment_manager, company_admin, super_admin
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'equipment_manager', 'company_admin', 'super_admin'));

-- Migrate existing 'admin' to 'super_admin'
UPDATE profiles SET role = 'super_admin' WHERE role = 'admin';

-- Companies (for multi-tenant)
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  subscription_level INTEGER NOT NULL DEFAULT 1,
  subscription_active BOOLEAN NOT NULL DEFAULT true,
  subscription_activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sites belong to companies
ALTER TABLE sites ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE;

-- Profiles can belong to a company (company_admin, equipment_manager, user)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL;

-- Profile access: add equipment_id for granular equipment-level access
ALTER TABLE profile_access ADD COLUMN IF NOT EXISTS equipment_id INTEGER REFERENCES equipment(id) ON DELETE CASCADE;

-- Update unique constraint to allow multiple equipment rows per (profile, site, department)
ALTER TABLE profile_access DROP CONSTRAINT IF EXISTS profile_access_profile_id_site_id_department_id_key;
ALTER TABLE profile_access DROP CONSTRAINT IF EXISTS profile_access_unique;
ALTER TABLE profile_access ADD CONSTRAINT profile_access_unique UNIQUE (profile_id, site_id, department_id, equipment_id);

-- Subscription level limits (Level 1–4)
-- Level 1: 1 site, 2 depts/site, 2 eq managers, 20 users
-- Level 2: 2 sites, 4 depts/site, 3 eq managers, 50 users
-- Level 3: 5 sites, 3 depts/site, 10 eq managers, 200 users
-- Level 4: 10 sites, 5 depts/site, 20 eq managers, 500 users (enterprise)
CREATE TABLE IF NOT EXISTS subscription_limits (
  level INTEGER PRIMARY KEY,
  max_sites INTEGER NOT NULL,
  max_departments_per_site INTEGER NOT NULL,
  max_equipment_managers INTEGER NOT NULL,
  max_users INTEGER NOT NULL
);

INSERT INTO subscription_limits (level, max_sites, max_departments_per_site, max_equipment_managers, max_users) VALUES
  (1, 1, 2, 2, 20),
  (2, 2, 4, 3, 50),
  (3, 5, 3, 10, 200),
  (4, 10, 5, 20, 500)
ON CONFLICT (level) DO UPDATE SET
  max_sites = EXCLUDED.max_sites,
  max_departments_per_site = EXCLUDED.max_departments_per_site,
  max_equipment_managers = EXCLUDED.max_equipment_managers,
  max_users = EXCLUDED.max_users;

-- Create default company for existing data
INSERT INTO companies (name, subscription_level, subscription_active) 
SELECT 'Default Company', 3, true 
WHERE NOT EXISTS (SELECT 1 FROM companies LIMIT 1);

UPDATE sites SET company_id = (SELECT id FROM companies LIMIT 1) WHERE company_id IS NULL;

-- Assign company admins to default company if they have none
UPDATE profiles SET company_id = (SELECT id FROM companies LIMIT 1) WHERE role = 'company_admin' AND company_id IS NULL;
