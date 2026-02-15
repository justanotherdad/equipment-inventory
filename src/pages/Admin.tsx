import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import { Navigate } from 'react-router-dom';
import { Users, Building2, FolderTree, ChevronDown, ChevronUp } from 'lucide-react';

type Role = 'user' | 'equipment_manager' | 'admin';

interface Profile {
  id: number;
  email: string;
  display_name: string | null;
  role: string;
}

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

interface ProfileAccess {
  site_id: number;
  department_id: number | null;
  site_name?: string;
  department_name?: string;
}

export default function Admin() {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedProfile, setExpandedProfile] = useState<number | null>(null);
  const [profileAccess, setProfileAccess] = useState<Record<number, ProfileAccess[]>>({});
  const [newSiteName, setNewSiteName] = useState('');
  const [newDeptSiteId, setNewDeptSiteId] = useState('');
  const [newDeptName, setNewDeptName] = useState('');

  if (profile?.role !== 'admin') return <Navigate to="/" replace />;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [p, s, d] = await Promise.all([
        api.admin.getProfiles(),
        api.admin.getSites(),
        api.admin.getDepartments(),
      ]);
      setProfiles(p);
      setSites(s);
      setDepartments(d);
      if (s.length && !newDeptSiteId) setNewDeptSiteId(String(s[0].id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadProfileAccess = async (profileId: number) => {
    try {
      const access = await api.admin.getProfileAccess(profileId);
      setProfileAccess((prev) => ({ ...prev, [profileId]: access }));
    } catch {
      setProfileAccess((prev) => ({ ...prev, [profileId]: [] }));
    }
  };

  const handleExpandProfile = (id: number) => {
    if (expandedProfile === id) {
      setExpandedProfile(null);
    } else {
      setExpandedProfile(id);
      if (!profileAccess[id]) loadProfileAccess(id);
    }
  };

  const handleRoleChange = async (profileId: number, role: Role) => {
    try {
      await api.admin.updateProfileRole(profileId, role);
      setProfiles((prev) => prev.map((p) => (p.id === profileId ? { ...p, role } : p)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update role');
    }
  };

  const handleSetAccess = async (profileId: number, access: { site_id: number; department_id?: number | null }[]) => {
    try {
      await api.admin.setProfileAccess(profileId, access);
      setProfileAccess((prev) => ({
        ...prev,
        [profileId]: access.map((a) => {
          const site = sites.find((s) => s.id === a.site_id);
          const dept = a.department_id ? departments.find((d) => d.id === a.department_id) : null;
          return {
            site_id: a.site_id,
            department_id: a.department_id ?? null,
            site_name: site?.name,
            department_name: dept?.name,
          };
        }),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update access');
    }
  };

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName.trim()) return;
    try {
      await api.admin.createSite(newSiteName.trim());
      setNewSiteName('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add site');
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptSiteId || !newDeptName.trim()) return;
    try {
      await api.admin.createDepartment(parseInt(newDeptSiteId, 10), newDeptName.trim());
      setNewDeptName('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add department');
    }
  };

  const addAccessRow = (profileId: number) => {
    const current = profileAccess[profileId] ?? [];
    const siteId = sites[0]?.id ?? 0;
    if (!siteId) return;
    handleSetAccess(profileId, [...current, { site_id: siteId }]);
  };

  const removeAccessRow = (profileId: number, idx: number) => {
    const current = profileAccess[profileId] ?? [];
    const next = current.filter((_, i) => i !== idx);
    handleSetAccess(profileId, next.map((a) => ({ site_id: a.site_id, department_id: a.department_id })));
  };

  const updateAccessRow = (profileId: number, idx: number, siteId: number, departmentId: number | null) => {
    const current = profileAccess[profileId] ?? [];
    const next = [...current];
    next[idx] = { ...next[idx], site_id: siteId, department_id: departmentId };
    handleSetAccess(profileId, next.map((a) => ({ site_id: a.site_id, department_id: a.department_id })));
  };

  if (loading) return <div className="page-header"><p>Loading…</p></div>;

  return (
    <div>
      <div className="page-header">
        <h2>Admin Panel</h2>
        <p style={{ color: 'var(--text-muted)' }}>Manage users, access levels, sites, and departments.</p>
      </div>
      {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}

      <div className="card">
        <h3 className="card-title"><Users size={20} /> Users & Access</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Set role (User, Equipment Manager, Admin) and assign site/department access. Users and equipment managers only see data for their assigned areas.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {profiles.map((p) => (
            <div key={p.id} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => handleExpandProfile(p.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  background: 'var(--bg-tertiary)',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span><strong>{p.email}</strong> — {p.role}</span>
                {expandedProfile === p.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {expandedProfile === p.id && (
                <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: 0.25, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Role</label>
                    <select
                      value={p.role}
                      onChange={(e) => handleRoleChange(p.id, e.target.value as Role)}
                      style={{ padding: '0.5rem', borderRadius: 6, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'inherit' }}
                    >
                      <option value="user">User</option>
                      <option value="equipment_manager">Equipment Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {(p.role === 'user' || p.role === 'equipment_manager') && (
                    <div>
                      <label style={{ display: 'block', marginBottom: 0.25, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Site / Department Access</label>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        Add site-wide (leave department blank) or department-specific access.
                      </p>
                      {(profileAccess[p.id] ?? []).map((a, idx) => (
                        <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                          <select
                            value={a.site_id}
                            onChange={(e) => updateAccessRow(p.id, idx, parseInt(e.target.value, 10), a.department_id)}
                            style={{ padding: '0.4rem', borderRadius: 6, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'inherit', flex: 1 }}
                          >
                            {sites.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <select
                            value={a.department_id ?? ''}
                            onChange={(e) => updateAccessRow(p.id, idx, a.site_id, e.target.value ? parseInt(e.target.value, 10) : null)}
                            style={{ padding: '0.4rem', borderRadius: 6, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'inherit', flex: 1 }}
                          >
                            <option value="">Entire site</option>
                            {departments.filter((d) => d.site_id === a.site_id).map((d) => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                          <button type="button" className="btn btn-danger" style={{ padding: '0.4rem 0.5rem' }} onClick={() => removeAccessRow(p.id, idx)}>Remove</button>
                        </div>
                      ))}
                      <button type="button" className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={() => addAccessRow(p.id)}>+ Add access</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="card-title"><Building2 size={20} /> Sites</h3>
        <form onSubmit={handleAddSite} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="New site name"
            value={newSiteName}
            onChange={(e) => setNewSiteName(e.target.value)}
            style={{ flex: 1, padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
          />
          <button type="submit" className="btn btn-primary">Add Site</button>
        </form>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
          {sites.map((s) => (
            <li key={s.id}>{s.name}</li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3 className="card-title"><FolderTree size={20} /> Departments</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          Departments belong to a site. Equipment is assigned to departments.
        </p>
        <form onSubmit={handleAddDepartment} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <select
            value={newDeptSiteId}
            onChange={(e) => setNewDeptSiteId(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Department name"
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            style={{ flex: 1, minWidth: 120, padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
          />
          <button type="submit" className="btn btn-primary">Add Department</button>
        </form>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)' }}>
          {departments.map((d) => (
            <li key={d.id}>{d.name} <span style={{ color: 'var(--text-muted)' }}>({d.site_name ?? 'Unknown'})</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
