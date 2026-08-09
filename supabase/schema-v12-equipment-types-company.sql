-- EquipForge: scope equipment_types to a single company
-- Run once in Supabase → SQL Editor (after v11 RLS).
--
-- Existing types used across companies are cloned per company and equipment
-- (plus request lines) are remapped so each company keeps its own type rows.
--
-- Uses no TEMP tables (Supabase SQL Editor can drop them mid-script).

BEGIN;

ALTER TABLE public.equipment_types
  ADD COLUMN IF NOT EXISTS company_id bigint REFERENCES public.companies(id);

-- Allow same type name in different companies
ALTER TABLE public.equipment_types DROP CONSTRAINT IF EXISTS equipment_types_name_key;
DROP INDEX IF EXISTS equipment_types_name_key;

-- Own each existing type by the lowest company_id that uses it
WITH type_company_usage AS (
  SELECT DISTINCT e.equipment_type_id, s.company_id
  FROM public.equipment e
  JOIN public.departments d ON d.id = e.department_id
  JOIN public.sites s ON s.id = d.site_id
  WHERE e.equipment_type_id IS NOT NULL
    AND s.company_id IS NOT NULL
),
first_company AS (
  SELECT equipment_type_id, MIN(company_id) AS company_id
  FROM type_company_usage
  GROUP BY equipment_type_id
)
UPDATE public.equipment_types et
SET company_id = fc.company_id
FROM first_company fc
WHERE et.id = fc.equipment_type_id
  AND et.company_id IS NULL;

-- Unused / unscoped types → first company (if any)
UPDATE public.equipment_types
SET company_id = (SELECT id FROM public.companies ORDER BY id LIMIT 1)
WHERE company_id IS NULL
  AND EXISTS (SELECT 1 FROM public.companies);

-- Clone types for other companies that already use them
INSERT INTO public.equipment_types (name, requires_calibration, calibration_frequency_months, company_id)
SELECT et.name, et.requires_calibration, et.calibration_frequency_months, u.company_id
FROM (
  SELECT DISTINCT e.equipment_type_id, s.company_id
  FROM public.equipment e
  JOIN public.departments d ON d.id = e.department_id
  JOIN public.sites s ON s.id = d.site_id
  WHERE e.equipment_type_id IS NOT NULL
    AND s.company_id IS NOT NULL
) u
JOIN public.equipment_types et ON et.id = u.equipment_type_id
WHERE u.company_id IS DISTINCT FROM et.company_id
  AND NOT EXISTS (
    SELECT 1
    FROM public.equipment_types x
    WHERE x.company_id = u.company_id
      AND x.name = et.name
  );

-- Remap equipment to the type owned by its site's company (same name)
UPDATE public.equipment e
SET equipment_type_id = map.new_type_id
FROM (
  SELECT
    e2.id AS equipment_id,
    et_new.id AS new_type_id
  FROM public.equipment e2
  JOIN public.departments d ON d.id = e2.department_id
  JOIN public.sites s ON s.id = d.site_id
  JOIN public.equipment_types et_old ON et_old.id = e2.equipment_type_id
  JOIN public.equipment_types et_new
    ON et_new.name = et_old.name
   AND et_new.company_id = s.company_id
  WHERE s.company_id IS NOT NULL
    AND e2.equipment_type_id IS DISTINCT FROM et_new.id
) map
WHERE e.id = map.equipment_id;

-- Remap request lines that point at a type from another company
UPDATE public.equipment_request_lines rl
SET equipment_type_id = map.new_type_id
FROM (
  SELECT
    rl2.id AS line_id,
    et_new.id AS new_type_id
  FROM public.equipment_request_lines rl2
  JOIN public.equipment_requests r ON r.id = rl2.equipment_request_id
  JOIN public.equipment eq ON eq.id = r.equipment_id
  JOIN public.departments d ON d.id = eq.department_id
  JOIN public.sites s ON s.id = d.site_id
  JOIN public.equipment_types et_old ON et_old.id = rl2.equipment_type_id
  JOIN public.equipment_types et_new
    ON et_new.name = et_old.name
   AND et_new.company_id = s.company_id
  WHERE s.company_id IS NOT NULL
    AND rl2.equipment_type_id IS DISTINCT FROM et_new.id
) map
WHERE rl.id = map.line_id;

-- Only enforce NOT NULL if every row has a company (avoids hard fail if no companies exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.equipment_types WHERE company_id IS NULL) THEN
    RAISE EXCEPTION 'Some equipment_types still have NULL company_id; add a company or assign them before SET NOT NULL';
  END IF;
END $$;

ALTER TABLE public.equipment_types
  ALTER COLUMN company_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS equipment_types_company_id_name_uidx
  ON public.equipment_types (company_id, name);

COMMIT;
