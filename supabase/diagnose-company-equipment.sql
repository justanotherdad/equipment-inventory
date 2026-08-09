-- Diagnostic: which company owns each site / equipment (read-only)
-- Run in Supabase SQL Editor to confirm equipment was not reassigned.

SELECT
  c.id AS company_id,
  c.name AS company_name,
  s.id AS site_id,
  s.name AS site_name,
  d.id AS department_id,
  d.name AS department_name,
  COUNT(e.id) AS equipment_count
FROM public.companies c
LEFT JOIN public.sites s ON s.company_id = c.id
LEFT JOIN public.departments d ON d.site_id = s.id
LEFT JOIN public.equipment e ON e.department_id = d.id
GROUP BY c.id, c.name, s.id, s.name, d.id, d.name
ORDER BY c.name, s.name, d.name;

-- Quick check for Ellab units from your screenshots:
SELECT
  e.serial_number,
  e.equipment_number,
  d.name AS department,
  s.name AS site,
  c.name AS company
FROM public.equipment e
JOIN public.departments d ON d.id = e.department_id
JOIN public.sites s ON s.id = d.site_id
JOIN public.companies c ON c.id = s.company_id
WHERE e.make ILIKE 'Ellab'
ORDER BY e.serial_number;
