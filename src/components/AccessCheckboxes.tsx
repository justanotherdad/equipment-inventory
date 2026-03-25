import { useState, useEffect, useMemo } from 'react';
import { Package } from 'lucide-react';

interface Site {
  id: number;
  name: string;
}

interface Department {
  id: number;
  site_id: number;
  name: string;
  site_name?: string;
}

interface Equipment {
  id: number;
  department_id: number | null;
  make: string;
  model: string;
  serial_number: string;
}

interface AccessState {
  siteIds: Set<number>;
  departmentIds: Set<number>;
  equipmentIds: Set<number>;
}

interface Props {
  sites: Site[];
  departments: Department[];
  equipment: Equipment[];
  access: { site_id: number; department_id: number | null; equipment_id?: number | null }[];
  onSave: (access: { site_id: number; department_id: number | null; equipment_id?: number | null }[]) => void;
  disabled?: boolean;
}

function toAccessState(access: { site_id: number; department_id: number | null; equipment_id?: number | null }[]): AccessState {
  const siteIds = new Set<number>();
  const departmentIds = new Set<number>();
  const equipmentIds = new Set<number>();
  for (const a of access) {
    if (a.equipment_id) equipmentIds.add(a.equipment_id);
    else if (a.department_id) departmentIds.add(a.department_id);
    else siteIds.add(a.site_id);
  }
  return { siteIds, departmentIds, equipmentIds };
}

function toAccessRows(state: AccessState, sites: Site[], departments: Department[], equipment: Equipment[]): { site_id: number; department_id: number | null; equipment_id?: number | null }[] {
  const rows: { site_id: number; department_id: number | null; equipment_id?: number | null }[] = [];
  for (const site of sites) {
    if (state.siteIds.has(site.id)) {
      rows.push({ site_id: site.id, department_id: null });
      continue;
    }
    const siteDepts = departments.filter((d) => d.site_id === site.id);
    for (const dept of siteDepts) {
      if (state.departmentIds.has(dept.id)) {
        rows.push({ site_id: site.id, department_id: dept.id });
        continue;
      }
      const deptEquip = equipment.filter((e) => e.department_id === dept.id);
      for (const eq of deptEquip) {
        if (state.equipmentIds.has(eq.id)) rows.push({ site_id: site.id, department_id: dept.id, equipment_id: eq.id });
      }
    }
  }
  return rows;
}

export default function AccessCheckboxes({ sites, departments, equipment, access, onSave, disabled }: Props) {
  const [state, setState] = useState<AccessState>(() => toAccessState(access));

  const sortedDepartments = useMemo(() => {
    return [...departments].sort((a, b) => {
      const sa = sites.find((s) => s.id === a.site_id)?.name ?? '';
      const sb = sites.find((s) => s.id === b.site_id)?.name ?? '';
      const c = sa.localeCompare(sb);
      return c !== 0 ? c : a.name.localeCompare(b.name);
    });
  }, [departments, sites]);

  useEffect(() => {
    setState(toAccessState(access));
  }, [access]);

  const visibleEquip = useMemo(() => {
    return equipment.filter((e) => {
      if (!e.department_id) return false;
      const d = departments.find((x) => x.id === e.department_id);
      if (!d) return false;
      return (
        state.equipmentIds.has(e.id) ||
        state.departmentIds.has(e.department_id) ||
        state.siteIds.has(d.site_id)
      );
    });
  }, [equipment, departments, state]);

  const toggleSite = (siteId: number, checked: boolean) => {
    const siteIds = new Set(state.siteIds);
    const departmentIds = new Set(state.departmentIds);
    const equipmentIds = new Set(state.equipmentIds);
    if (checked) {
      siteIds.add(siteId);
      departments.filter((d) => d.site_id === siteId).forEach((d) => departmentIds.delete(d.id));
      equipment
        .filter((e) => e.department_id && departments.find((d) => d.id === e.department_id)?.site_id === siteId)
        .forEach((e) => equipmentIds.delete(e.id));
    } else {
      siteIds.delete(siteId);
    }
    const next = { siteIds, departmentIds, equipmentIds };
    setState(next);
    onSave(toAccessRows(next, sites, departments, equipment));
  };

  const toggleAllSites = (checked: boolean) => {
    const siteIds = checked ? new Set(sites.map((s) => s.id)) : new Set<number>();
    const departmentIds = new Set<number>();
    const equipmentIds = new Set<number>();
    const next = { siteIds, departmentIds, equipmentIds };
    setState(next);
    onSave(toAccessRows(next, sites, departments, equipment));
  };

  const toggleDepartment = (deptId: number, checked: boolean) => {
    const dept = departments.find((d) => d.id === deptId);
    if (!dept) return;
    if (state.siteIds.has(dept.site_id) && checked) return;
    const siteIds = new Set(state.siteIds);
    const departmentIds = new Set(state.departmentIds);
    const equipmentIds = new Set(state.equipmentIds);

    if (state.siteIds.has(dept.site_id)) {
      const siteDepts = departments.filter((d) => d.site_id === dept.site_id);
      siteIds.delete(dept.site_id);
      if (!checked) {
        siteDepts.forEach((d) => {
          if (d.id !== deptId) departmentIds.add(d.id);
        });
        equipment
          .filter((e) => e.department_id && siteDepts.some((sd) => sd.id === e.department_id))
          .forEach((e) => equipmentIds.delete(e.id));
      }
    } else if (checked) {
      siteIds.delete(dept.site_id);
      departmentIds.add(deptId);
      equipment.filter((e) => e.department_id === deptId).forEach((e) => equipmentIds.delete(e.id));
    } else {
      departmentIds.delete(deptId);
    }
    const next = { siteIds, departmentIds, equipmentIds };
    setState(next);
    onSave(toAccessRows(next, sites, departments, equipment));
  };

  const toggleAllDepartments = (checked: boolean) => {
    const siteIds = new Set(state.siteIds);
    const departmentIds = new Set(state.departmentIds);
    const equipmentIds = new Set(state.equipmentIds);
    if (checked) {
      sortedDepartments.forEach((d) => {
        siteIds.delete(d.site_id);
        departmentIds.add(d.id);
      });
      sortedDepartments.flatMap((d) => equipment.filter((e) => e.department_id === d.id)).forEach((e) => equipmentIds.delete(e.id));
    } else {
      sortedDepartments.forEach((d) => departmentIds.delete(d.id));
    }
    const next = { siteIds, departmentIds, equipmentIds };
    setState(next);
    onSave(toAccessRows(next, sites, departments, equipment));
  };

  const toggleEquipment = (eqId: number, checked: boolean) => {
    const eq = equipment.find((e) => e.id === eqId);
    if (!eq?.department_id) return;
    const dept = departments.find((d) => d.id === eq.department_id);
    if (!dept) return;
    const siteIds = new Set(state.siteIds);
    const departmentIds = new Set(state.departmentIds);
    const equipmentIds = new Set(state.equipmentIds);
    if (checked) {
      siteIds.delete(dept.site_id);
      departmentIds.delete(dept.id);
      equipmentIds.add(eqId);
    } else {
      equipmentIds.delete(eqId);
    }
    const next = { siteIds, departmentIds, equipmentIds };
    setState(next);
    onSave(toAccessRows(next, sites, departments, equipment));
  };

  const toggleAllEquipment = (checked: boolean) => {
    const siteIds = new Set(state.siteIds);
    const departmentIds = new Set(state.departmentIds);
    const equipmentIds = new Set(state.equipmentIds);
    if (checked) {
      visibleEquip.forEach((e) => {
        if (e.department_id) {
          const d = departments.find((x) => x.id === e.department_id);
          if (d) {
            siteIds.delete(d.site_id);
            departmentIds.delete(d.id);
          }
          equipmentIds.add(e.id);
        }
      });
    } else {
      visibleEquip.forEach((e) => equipmentIds.delete(e.id));
    }
    const next = { siteIds, departmentIds, equipmentIds };
    setState(next);
    onSave(toAccessRows(next, sites, departments, equipment));
  };

  const allSitesChecked = sites.length > 0 && sites.every((s) => state.siteIds.has(s.id));
  const allDeptsExplicitOrSite =
    sortedDepartments.length > 0 &&
    sortedDepartments.every((d) => state.departmentIds.has(d.id) || state.siteIds.has(d.site_id));
  const hasEquipAccess = (eq: Equipment) => {
    if (!eq.department_id) return false;
    const d = departments.find((x) => x.id === eq.department_id);
    return d && (state.siteIds.has(d.site_id) || state.departmentIds.has(eq.department_id) || state.equipmentIds.has(eq.id));
  };
  const isEquipInherited = (eq: Equipment) => {
    if (!eq.department_id) return false;
    const d = departments.find((x) => x.id === eq.department_id);
    return d && (state.siteIds.has(d.site_id) || state.departmentIds.has(eq.department_id));
  };
  const isDeptInherited = (deptId: number) => {
    const d = departments.find((x) => x.id === deptId);
    return d && state.siteIds.has(d.site_id);
  };

  const checkboxCol = { flex: '0 0 1.25rem', width: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' };
  const rowStyle = { display: 'flex', alignItems: 'center', gap: '0.5rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <label style={{ ...rowStyle, marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
          <span style={checkboxCol}>
            <input
              type="checkbox"
              checked={allSitesChecked}
              ref={(el) => {
                if (el) el.indeterminate = sites.length > 0 && !allSitesChecked && sites.some((s) => state.siteIds.has(s.id));
              }}
              onChange={(e) => toggleAllSites(e.target.checked)}
              disabled={disabled}
            />
          </span>
          Sites
        </label>
        <div style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {sites.map((s) => (
            <label key={s.id} style={{ ...rowStyle, cursor: disabled ? 'default' : 'pointer' }}>
              <span style={checkboxCol}>
                <input
                  type="checkbox"
                  checked={state.siteIds.has(s.id)}
                  onChange={(e) => toggleSite(s.id, e.target.checked)}
                  disabled={disabled}
                />
              </span>
              {s.name}
            </label>
          ))}
        </div>
      </div>

      {sortedDepartments.length > 0 && (
        <div>
          <label style={{ ...rowStyle, marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
            <span style={checkboxCol}>
              <input
                type="checkbox"
                checked={allDeptsExplicitOrSite}
                ref={(el) => {
                  if (el) {
                    const some = sortedDepartments.some((d) => state.departmentIds.has(d.id) || state.siteIds.has(d.site_id));
                    el.indeterminate = sortedDepartments.length > 0 && !allDeptsExplicitOrSite && some;
                  }
                }}
                onChange={(e) => toggleAllDepartments(e.target.checked)}
                disabled={disabled}
              />
            </span>
            Departments
          </label>
          <div style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {sortedDepartments.map((d) => (
              <label key={d.id} style={{ ...rowStyle, cursor: disabled ? 'default' : 'pointer' }}>
                <span style={checkboxCol}>
                  <input
                    type="checkbox"
                    checked={state.siteIds.has(d.site_id) || state.departmentIds.has(d.id)}
                    onChange={(e) => toggleDepartment(d.id, e.target.checked)}
                    disabled={disabled}
                  />
                </span>
                {d.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>({sites.find((s) => s.id === d.site_id)?.name})</span>
                {isDeptInherited(d.id) && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.25rem' }}>via site</span>
                )}
              </label>
            ))}
          </div>
        </div>
      )}

      {visibleEquip.length > 0 && (
        <div>
          <label style={{ ...rowStyle, marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer' }}>
            <span style={checkboxCol}>
              <input
                type="checkbox"
                checked={visibleEquip.every((e) => hasEquipAccess(e))}
                ref={(el) => {
                  if (el) {
                    const some = visibleEquip.some((e) => hasEquipAccess(e));
                    el.indeterminate =
                      visibleEquip.length > 0 && !visibleEquip.every((e) => hasEquipAccess(e)) && some;
                  }
                }}
                onChange={(e) => toggleAllEquipment(e.target.checked)}
                disabled={disabled || (visibleEquip.length > 0 && visibleEquip.every((e) => isEquipInherited(e)))}
              />
            </span>
            Equipment
          </label>
          <div style={{ paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', maxHeight: 200, overflowY: 'auto' }}>
            {visibleEquip.map((eq) => (
              <label key={eq.id} style={{ ...rowStyle, cursor: disabled || isEquipInherited(eq) ? 'default' : 'pointer' }}>
                <span style={checkboxCol}>
                  <input
                    type="checkbox"
                    checked={hasEquipAccess(eq)}
                    onChange={(e) => toggleEquipment(eq.id, e.target.checked)}
                    disabled={disabled || isEquipInherited(eq)}
                  />
                </span>
                <Package size={14} />
                {eq.make} {eq.model} — {eq.serial_number}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
