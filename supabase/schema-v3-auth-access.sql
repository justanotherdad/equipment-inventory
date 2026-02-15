-- Auth, Sites, Departments, and Access Control
-- Run after schema.sql and schema-v2-requests.sql

-- Sites (top-level locations)
CREATE TABLE IF NOT EXISTS sites (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Departments (belong to a site)
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, name)
);

-- Profiles (linked to Supabase Auth users)
CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  auth_user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'equipment_manager', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Access: which sites/departments a user or equipment manager can access
-- department_id NULL = access to entire site; department_id set = access to that department only
CREATE TABLE IF NOT EXISTS profile_access (
  id SERIAL PRIMARY KEY,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, site_id, department_id)
);

-- Add department to equipment
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;

-- Equipment types: optionally scoped to site (null = global)
ALTER TABLE equipment_types ADD COLUMN IF NOT EXISTS site_id INTEGER REFERENCES sites(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_departments_site ON departments(site_id);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_user ON profiles(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_access_profile ON profile_access(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_access_site ON profile_access(site_id);
CREATE INDEX IF NOT EXISTS idx_equipment_department ON equipment(department_id);

-- Seed default site and department for existing data
INSERT INTO sites (name)
SELECT 'Default Site' WHERE NOT EXISTS (SELECT 1 FROM sites WHERE name = 'Default Site');

INSERT INTO departments (site_id, name)
SELECT s.id, 'Default Department' FROM sites s
WHERE s.name = 'Default Site'
  AND NOT EXISTS (SELECT 1 FROM departments d WHERE d.site_id = s.id AND d.name = 'Default Department')
LIMIT 1;

-- Assign existing equipment to default department
UPDATE equipment SET department_id = (SELECT id FROM departments WHERE name = 'Default Department' LIMIT 1)
WHERE department_id IS NULL AND EXISTS (SELECT 1 FROM departments WHERE name = 'Default Department');
