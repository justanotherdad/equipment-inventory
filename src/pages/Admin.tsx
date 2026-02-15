import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import { Navigate } from 'react-router-dom';
import { Users, Building2, FolderTree, ChevronDown, ChevronUp, CreditCard } from 'lucide-react';
import AccessCheckboxes from '../components/AccessCheckboxes';

type Role = 'user' | 'equipment_manager' | 'company_admin' | 'super_admin';

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

interface Equipment {
  id: number;
  department_id: number | null;
  make: string;
  model: string;
  serial_number: string;
}

interface ProfileAccess {
  site_id: number;
  department_id: number | null;
  equipment_id?: number | null;
  site_name?: string;
  department_name?: string;
}

interface Company {
  id: number;
  name: string;
  subscription_level: number;
  subscription_active: boolean;
  subscription_activated_at: string | null;
}

export default function Admin() {
  const { profile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedProfile, setExpandedProfile] = useState<number | null>(null);
  const [profileAccess, setProfileAccess] = useState<Record<number, ProfileAccess[]>>({});
  const [newSiteName, setNewSiteName] = useState('');
  const [newDeptSiteId, setNewDeptSiteId] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserAccess, setNewUserAccess] = useState<{ site_id: number; department_id: number | null; equipment_id?: number | null }[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);

  const isFullAdmin = profile?.role === 'super_admin' || profile?.role === 'company_admin';
  const canCreateUser = isFullAdmin || profile?.role === 'equipment_manager';
  if (!canCreateUser) return <Navigate to="/dashboard" replace />;

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      if (isFullAdmin) {
        const promises: Promise<unknown>[] = [
          api.admin.getProfiles(),
          api.admin.getSites(),
          api.admin.getDepartments(),
          api.equipment.getAll(),
        ];
        if (profile?.role === 'super_admin') {
          promises.push(api.admin.getCompanies());
        }
        const results = await Promise.all(promises);
        setProfiles(results[0] as Profile[]);
        setSites(results[1] as Site[]);
        setDepartments(results[2] as Department[]);
        setEquipment((results[3] as { id: number; department_id: number | null; make: string; model: string; serial_number: string }[]) ?? []);
        const s = results[1] as Site[];
        if (s.length && !newDeptSiteId) setNewDeptSiteId(String(s[0].id));
        if (profile?.role === 'super_admin' && results[4]) {
          setCompanies(results[4] as Company[]);
        }
      } else {
        const [d, eq] = await Promise.all([
          api.departments.getAll(),
          api.equipment.getAll(),
        ]);
        const depts = d as { id: number; site_id: number; name: string; site_name?: string }[];
        const sitesFromDepts = [...new Map(depts.map((x) => [x.site_id, { id: x.site_id, name: x.site_name || `Site ${x.site_id}` }])).values()];
        setSites(sitesFromDepts);
        setDepartments(depts);
        setEquipment((eq as { id: number; department_id: number | null; make: string; model: string; serial_number: string }[]) ?? []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) load();
  }, [profile?.role]);

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

  const handleSetAccess = async (profileId: number, access: { site_id: number; department_id?: number | null; equipment_id?: number | null }[]) => {
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
            equipment_id: a.equipment_id ?? null,
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserPassword.trim()) return;
    if (newUserPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setCreatingUser(true);
    setError('');
    try {
      await api.admin.createUser(newUserEmail.trim(), newUserPassword.trim(), newUserAccess);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserAccess([]);
      if (isFullAdmin) load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleSubscriptionToggle = async (companyId: number, active: boolean, level?: number) => {
    try {
      await api.admin.updateCompanySubscription(companyId, active, level);
      setCompanies((prev) =>
        prev.map((c) =>
          c.id === companyId
            ? { ...c, subscription_active: active, subscription_level: level ?? c.subscription_level, subscription_activated_at: active ? new Date().toISOString() : c.subscription_activated_at }
            : c
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update subscription');
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

  if (loading) return <div className="page-header"><p>Loading…</p></div>;

  return (
    <div>
      <div className="page-header">
        <h2>{isFullAdmin ? 'Admin Panel' : 'Create User'}</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          {isFullAdmin ? 'Manage users, access levels, sites, and departments.' : 'Add a new user within your access scope.'}
        </p>
      </div>
      {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}

      {canCreateUser && (
        <div className="card">
          <h3 className="card-title">Create User</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Create a new user account. They can sign in with the email and password you set.
          </p>
          <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 400 }}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="user@example.com"
                required
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
                minLength={6}
                style={{ width: '100%' }}
              />
            </div>
            {profile?.role === 'equipment_manager' && (
              <div>
                <label style={{ display: 'block', marginBottom: 0.25, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Access (within your scope)</label>
                <AccessCheckboxes
                  sites={sites}
                  departments={departments}
                  equipment={equipment}
                  access={newUserAccess}
                  onSave={setNewUserAccess}
                />
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={creatingUser}>
              {creatingUser ? 'Creating…' : 'Create User'}
            </button>
          </form>
        </div>
      )}

      {isFullAdmin && (
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
                      <option value="company_admin">Company Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                  {(p.role === 'user' || p.role === 'equipment_manager') && (
                    <div>
                      <label style={{ display: 'block', marginBottom: 0.25, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Site / Department / Equipment Access</label>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                        Check sites for full site access, or drill down to departments and specific equipment.
                      </p>
                      <AccessCheckboxes
                        sites={sites}
                        departments={departments}
                        equipment={equipment}
                        access={(profileAccess[p.id] ?? []).map((a) => ({
                          site_id: a.site_id,
                          department_id: a.department_id,
                          equipment_id: a.equipment_id ?? null,
                        }))}
                        onSave={(rows) => handleSetAccess(p.id, rows)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      )}

      {profile?.role === 'super_admin' && companies.length > 0 && (
        <div className="card">
          <h3 className="card-title"><CreditCard size={20} /> Subscription</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            Enable or disable subscription per company. Level 1–4 controls limits (sites, departments, users).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {companies.map((c) => (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                }}
              >
                <div>
                  <strong>{c.name}</strong>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Level {c.subscription_level} • {c.subscription_active ? 'Active' : 'Disabled'}
                    {c.subscription_activated_at && (
                      <span> • Activated {new Date(c.subscription_activated_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <select
                    value={c.subscription_level}
                    onChange={(e) => handleSubscriptionToggle(c.id, c.subscription_active, parseInt(e.target.value, 10))}
                    style={{ padding: '0.4rem 0.5rem', borderRadius: 6, background: 'var(--bg-primary)', border: '1px solid var(--border)', color: 'inherit' }}
                  >
                    <option value={1}>Level 1</option>
                    <option value={2}>Level 2</option>
                    <option value={3}>Level 3</option>
                    <option value={4}>Level 4</option>
                  </select>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={c.subscription_active}
                      onChange={(e) => handleSubscriptionToggle(c.id, e.target.checked)}
                    />
                    Active
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isFullAdmin && (
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
      )}

      {isFullAdmin && (
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
      )}
    </div>
  );
}
