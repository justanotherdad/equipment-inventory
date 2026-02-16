import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import { Navigate } from 'react-router-dom';
import { Users, Building2, FolderTree, CreditCard, Pencil, Trash2, UserPlus } from 'lucide-react';
import AccessCheckboxes from '../components/AccessCheckboxes';
import PasswordInput from '../components/PasswordInput';
import { AdminTable, AdminTableColumn } from '../components/AdminTable';

type Role = 'user' | 'equipment_manager' | 'company_admin' | 'super_admin';

interface Profile {
  id: number;
  email: string;
  display_name: string | null;
  role: string;
  company_id?: number | null;
  company_name?: string | null;
}

interface Site {
  id: number;
  name: string;
  company_id?: number | null;
  company_name?: string | null;
}

interface Department {
  id: number;
  site_id: number;
  name: string;
  site_name?: string;
  company_name?: string | null;
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
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
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
  const [profileAccess, setProfileAccess] = useState<Record<number, ProfileAccess[]>>({});
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteCompanyId, setNewSiteCompanyId] = useState<string>('');
  const [newDeptSiteId, setNewDeptSiteId] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('user');
  const [newUserCompanyId, setNewUserCompanyId] = useState<string>('');
  const [newUserAccess, setNewUserAccess] = useState<{ site_id: number; department_id: number | null; equipment_id?: number | null }[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [companyForm, setCompanyForm] = useState<Partial<Company>>({});
  const [editUserModal, setEditUserModal] = useState<Profile | null>(null);
  const [editSiteModal, setEditSiteModal] = useState<Site | null>(null);
  const [editDeptModal, setEditDepartmentModal] = useState<Department | null>(null);
  const [editDeptCompanyId, setEditDeptCompanyId] = useState<number | null>(null);
  const [editDeptSiteId, setEditDeptSiteId] = useState<number | null>(null);
  const [editSubscriptionModal, setEditSubscriptionModal] = useState<Company | null>(null);
  const [editSubscriptionForm, setEditSubscriptionForm] = useState<Partial<Company>>({});
  const [addCompanyModal, setAddCompanyModal] = useState(false);
  const [createUserModal, setCreateUserModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyContactEmail, setNewCompanyContactEmail] = useState('');
  const [newCompanyContactName, setNewCompanyContactName] = useState('');
  const [newCompanyAdminEmail, setNewCompanyAdminEmail] = useState('');
  const [newCompanyAdminPassword, setNewCompanyAdminPassword] = useState('');
  const [createCompanyWithAdmin, setCreateCompanyWithAdmin] = useState(true);
  const [deleteCompanyModal, setDeleteCompanyModal] = useState<Company | null>(null);
  const [closeCompanyModal, setCloseCompanyModal] = useState(false);
  const [closeCompanyConfirm, setCloseCompanyConfirm] = useState('');
  const [closingCompany, setClosingCompany] = useState(false);

  const isSuperAdmin = profile?.role === 'super_admin';
  const isFullAdmin = profile?.role === 'super_admin' || profile?.role === 'company_admin';
  const canCreateUser = isFullAdmin || profile?.role === 'equipment_manager';
  if (!canCreateUser) return <Navigate to="/dashboard" replace />;

  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      if (isFullAdmin) {
        const promises: Promise<unknown>[] = [
          api.admin.getProfiles(),
          api.admin.getSites(),
          api.admin.getDepartments(),
          api.equipment.getAll(),
        ];
        if (isSuperAdmin) {
          promises.push(api.admin.getCompanies());
        }
        const results = await Promise.all(promises);
        setProfiles(results[0] as Profile[]);
        setSites(results[1] as Site[]);
        setDepartments(results[2] as Department[]);
        setEquipment((results[3] as Equipment[]) ?? []);
        const s = results[1] as Site[];
        if (s.length && !newDeptSiteId) setNewDeptSiteId(String(s[0].id));
        if (isSuperAdmin && results[4]) {
          setCompanies(results[4] as Company[]);
          if (!selectedCompanyId && (results[4] as Company[]).length) {
            setSelectedCompanyId((results[4] as Company[])[0].id);
          }
        }
        if (profile?.role === 'company_admin' && profile?.company_id) {
          setSelectedCompanyId(profile.company_id);
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
        setEquipment((eq as Equipment[]) ?? []);
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

  useEffect(() => {
    if (selectedCompanyId && isSuperAdmin) {
      api.admin.getCompany(selectedCompanyId).then((c) => setCompanyForm(c)).catch(() => setCompanyForm({}));
    } else if (profile?.role === 'company_admin' && profile?.company_id) {
      api.admin.getCompany(profile.company_id).then((c) => setCompanyForm(c)).catch(() => setCompanyForm({}));
    }
  }, [selectedCompanyId, isSuperAdmin, profile?.role, profile?.company_id]);

  const loadProfileAccess = async (profileId: number) => {
    try {
      const access = await api.admin.getProfileAccess(profileId);
      setProfileAccess((prev) => ({ ...prev, [profileId]: access }));
    } catch {
      setProfileAccess((prev) => ({ ...prev, [profileId]: [] }));
    }
  };

  const handleRoleChange = async (profileId: number, role: Role) => {
    try {
      await api.admin.updateProfileRole(profileId, role);
      setProfiles((prev) => prev.map((p) => (p.id === profileId ? { ...p, role } : p)));
      if (editUserModal?.id === profileId) setEditUserModal((m) => m ? { ...m, role } : null);
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

  const handleDeleteProfile = async (id: number) => {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    try {
      await api.admin.deleteProfile(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      setEditUserModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete user');
    }
  };

  const handleSaveCompany = async () => {
    const id = selectedCompanyId ?? (profile?.role === 'company_admin' ? profile.company_id : null);
    if (!id) return;
    try {
      await api.admin.updateCompany(id, {
        name: companyForm.name,
        contact_name: companyForm.contact_name,
        contact_email: companyForm.contact_email,
        contact_phone: companyForm.contact_phone,
        address_line1: companyForm.address_line1,
        address_line2: companyForm.address_line2,
        address_city: companyForm.address_city,
        address_state: companyForm.address_state,
        address_zip: companyForm.address_zip,
      });
      await load(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save company');
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;
    if (createCompanyWithAdmin && (!newCompanyAdminEmail.trim() || !newCompanyAdminPassword.trim())) {
      setError('Admin email and password required when creating company admin');
      return;
    }
    if (createCompanyWithAdmin && newCompanyAdminPassword.length < 6) {
      setError('Admin password must be at least 6 characters');
      return;
    }
    try {
      await api.admin.createCompany({
        name: newCompanyName.trim(),
        contact_email: newCompanyContactEmail.trim() || newCompanyAdminEmail.trim(),
        contact_name: newCompanyContactName.trim() || undefined,
        create_admin: createCompanyWithAdmin,
        admin_email: createCompanyWithAdmin ? newCompanyAdminEmail.trim() : undefined,
        admin_password: createCompanyWithAdmin ? newCompanyAdminPassword : undefined,
      });
      setAddCompanyModal(false);
      setNewCompanyName('');
      setNewCompanyContactEmail('');
      setNewCompanyContactName('');
      setNewCompanyAdminEmail('');
      setNewCompanyAdminPassword('');
      await load(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add company');
    }
  };

  const handleUpdateProfile = async (profileId: number, data: { display_name?: string | null; email?: string; company_id?: number | null }) => {
    try {
      await api.admin.updateProfile(profileId, data);
      await load(false);
      setEditUserModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update user');
    }
  };

  const handleSaveSubscription = async (company: Company, formData: Partial<Company>) => {
    try {
      await api.admin.updateCompany(company.id, {
        name: formData.name,
        contact_name: formData.contact_name,
        contact_email: formData.contact_email,
        contact_phone: formData.contact_phone,
        address_line1: formData.address_line1,
        address_line2: formData.address_line2,
        address_city: formData.address_city,
        address_state: formData.address_state,
        address_zip: formData.address_zip,
        subscription_level: formData.subscription_level,
        subscription_active: formData.subscription_active,
      });
      await load(false);
      setEditSubscriptionModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save subscription');
    }
  };

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName.trim()) return;
    try {
      await api.admin.createSite(newSiteName.trim(), isSuperAdmin && newSiteCompanyId ? parseInt(newSiteCompanyId, 10) : undefined);
      setNewSiteName('');
      await load(false);
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
      await api.admin.createUser(
        newUserEmail.trim(),
        newUserPassword.trim(),
        newUserAccess,
        newUserRole,
        isSuperAdmin && newUserCompanyId ? parseInt(newUserCompanyId, 10) : undefined
      );
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserAccess([]);
      setCreateUserModal(false);
      if (isFullAdmin) await load(false);
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

  const handleDeleteCompany = async (company: Company) => {
    if (!confirm(`Permanently delete "${company.name}" and all its data (sites, departments, equipment, users)? This cannot be undone.`)) return;
    try {
      await api.admin.deleteCompany(company.id);
      setDeleteCompanyModal(null);
      await load(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete company');
    }
  };

  const handleCloseCompany = async () => {
    const name = (companyForm.name ?? '').trim();
    if (!name || closeCompanyConfirm.trim().toUpperCase() !== name.toUpperCase()) {
      setError('Type the company name exactly to confirm');
      return;
    }
    if (!profile?.company_id) return;
    setClosingCompany(true);
    setError('');
    try {
      await api.admin.closeCompany(profile.company_id, closeCompanyConfirm.trim());
      setCloseCompanyModal(false);
      setCloseCompanyConfirm('');
      window.location.href = '/login';
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to close company');
    } finally {
      setClosingCompany(false);
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeptSiteId || !newDeptName.trim()) return;
    try {
      await api.admin.createDepartment(parseInt(newDeptSiteId, 10), newDeptName.trim());
      setNewDeptName('');
      await load(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add department');
    }
  };

  const handleUpdateSite = async (id: number, data: { name: string; company_id?: number | null }) => {
    try {
      await api.admin.updateSite(id, data);
      await load(false);
      setEditSiteModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update site');
    }
  };

  const handleDeleteSite = async (id: number) => {
    if (!confirm('Delete this site? Departments under it may be affected.')) return;
    try {
      await api.admin.deleteSite(id);
      await load(false);
      setEditSiteModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete site');
    }
  };

  const handleUpdateDepartment = async (id: number, data: { name: string; site_id: number }) => {
    try {
      await api.admin.updateDepartment(id, data);
      await load(false);
      setEditDepartmentModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update department');
    }
  };

  const handleDeleteDepartment = async (id: number) => {
    if (!confirm('Delete this department?')) return;
    try {
      await api.admin.deleteDepartment(id);
      await load(false);
      setEditDepartmentModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete department');
    }
  };

  const usersColumns: AdminTableColumn<Profile>[] = [
    { key: 'display_name', label: 'Name', value: (r) => r.display_name ?? r.email, sortable: true, filterable: true },
    { key: 'email', label: 'Email', value: (r) => r.email, sortable: true, filterable: true },
    { key: 'role', label: 'Role', value: (r) => r.role, sortable: true, filterable: true },
    ...(isSuperAdmin ? [{ key: 'company_name', label: 'Company', value: (r) => r.company_name ?? '', sortable: true, filterable: true }] : []),
  ].filter(Boolean) as AdminTableColumn<Profile>[];

  const sitesColumns: AdminTableColumn<Site>[] = [
    ...(isSuperAdmin ? [{ key: 'company_name', label: 'Company', value: (r) => r.company_name ?? '', sortable: true, filterable: true }] : []),
    { key: 'name', label: 'Site', value: (r) => r.name, sortable: true, filterable: true },
  ].filter(Boolean) as AdminTableColumn<Site>[];

  const deptsColumns: AdminTableColumn<Department>[] = [
    ...(isSuperAdmin ? [{ key: 'company_name', label: 'Company', value: (r) => r.company_name ?? '', sortable: true, filterable: true }] : []),
    { key: 'name', label: 'Department', value: (r) => r.name, sortable: true, filterable: true },
    { key: 'site_name', label: 'Site', value: (r) => r.site_name ?? '', sortable: true, filterable: true },
  ].filter(Boolean) as AdminTableColumn<Department>[];

  if (loading) return <div className="page-header"><p>Loading…</p></div>;

  return (
    <div className="admin-page">
      <div className="page-header">
        <h2>{isFullAdmin ? 'Admin Panel' : 'Create User'}</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          {isFullAdmin ? 'Manage users, access levels, sites, and departments.' : 'Add a new user within your access scope.'}
        </p>
      </div>
      {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}

      {isFullAdmin && (
        <div className="admin-top-grid">
          {/* Row 1, Col 1: Company Info (narrower) */}
          {(isSuperAdmin || profile?.role === 'company_admin') && (
            <div className="card company-info-compact admin-company-info">
              <h3 className="card-title"><Building2 size={20} /> Company Info</h3>
              {isSuperAdmin && companies.length > 0 && (
                <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                  <label>Company</label>
                  <select
                    value={selectedCompanyId ?? ''}
                    onChange={(e) => setSelectedCompanyId(e.target.value ? parseInt(e.target.value, 10) : null)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div className="form-group">
                  <label>Company Name</label>
                  <input
                    type="text"
                    value={companyForm.name ?? ''}
                    onChange={(e) => setCompanyForm((f) => ({ ...f, name: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                  />
                </div>
                <div className="form-group">
                  <label>Main Contact Name</label>
                  <input
                    type="text"
                    value={companyForm.contact_name ?? ''}
                    onChange={(e) => setCompanyForm((f) => ({ ...f, contact_name: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                  />
                </div>
                <div className="form-group">
                  <label>Contact Email</label>
                  <input
                    type="email"
                    value={companyForm.contact_email ?? ''}
                    onChange={(e) => setCompanyForm((f) => ({ ...f, contact_email: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                  />
                </div>
                <div className="form-group">
                  <label>Contact Phone</label>
                  <input
                    type="tel"
                    value={companyForm.contact_phone ?? ''}
                    onChange={(e) => setCompanyForm((f) => ({ ...f, contact_phone: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                  />
                </div>
                <div className="form-group">
                  <label>Address Line 1</label>
                  <input
                    type="text"
                    value={companyForm.address_line1 ?? ''}
                    onChange={(e) => setCompanyForm((f) => ({ ...f, address_line1: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                  />
                </div>
                <div className="form-group">
                  <label>Address Line 2</label>
                  <input
                    type="text"
                    value={companyForm.address_line2 ?? ''}
                    onChange={(e) => setCompanyForm((f) => ({ ...f, address_line2: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                  />
                </div>
                <div className="admin-address-grid">
                  <div className="form-group">
                    <label>City</label>
                    <input
                      type="text"
                      value={companyForm.address_city ?? ''}
                      onChange={(e) => setCompanyForm((f) => ({ ...f, address_city: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                    />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input
                      type="text"
                      value={companyForm.address_state ?? ''}
                      onChange={(e) => setCompanyForm((f) => ({ ...f, address_state: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                    />
                  </div>
                  <div className="form-group">
                    <label>ZIP</label>
                    <input
                      type="text"
                      value={companyForm.address_zip ?? ''}
                      onChange={(e) => setCompanyForm((f) => ({ ...f, address_zip: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                    />
                  </div>
                </div>
                <button type="button" className="btn btn-primary" onClick={handleSaveCompany}>Save Company</button>
                {profile?.role === 'company_admin' && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ marginTop: '1rem' }}
                    onClick={() => { setCloseCompanyModal(true); setCloseCompanyConfirm(''); setError(''); }}
                  >
                    Close Company & Delete All Data
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Row 1, Col 2: Sites */}
          <div className="card admin-sites-col">
            <h3 className="card-title"><Building2 size={20} /> Sites</h3>
            <form onSubmit={handleAddSite} className="admin-form-row" style={{ marginBottom: '1rem' }}>
              {isSuperAdmin && companies.length > 0 && (
                <select
                  value={newSiteCompanyId}
                  onChange={(e) => setNewSiteCompanyId(e.target.value)}
                  style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                >
                  <option value="">Select company</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                placeholder="New site name"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                style={{ flex: 1, minWidth: 120, padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
              />
              <button type="submit" className="btn btn-primary">Add Site</button>
            </form>
            <AdminTable
              columns={sitesColumns}
              data={sites}
              searchPlaceholder="Search sites…"
              renderActions={(row) => (
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} onClick={() => setEditSiteModal(row)}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} onClick={() => handleDeleteSite(row.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
              emptyMessage="No sites"
            />
          </div>

          {/* Subscriptions - Super Admin (above Users & Access) */}
          {isSuperAdmin && (
            <div className="card admin-subscriptions-col">
              <div className="admin-subscriptions-header">
                <div>
                  <h3 className="card-title"><CreditCard size={20} /> Subscriptions</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                    Enable or disable subscription per company. Level 1–4 controls limits.
                  </p>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => setAddCompanyModal(true)}>Add Company</button>
              </div>
              <AdminTable
                columns={[
                  { key: 'name', label: 'Company', value: (r) => r.name },
                  { key: 'contact_name', label: 'Contact', value: (r) => r.contact_name ?? '' },
                  { key: 'contact_email', label: 'Email', value: (r) => r.contact_email ?? '' },
                  { key: 'status', label: 'Status', render: (r) => (r.subscription_active ? 'Active' : 'Disabled') },
                  { key: 'subscription_level', label: 'Level', render: (r) => `Level ${r.subscription_level}` },
                  { key: 'active', label: 'Active', render: (r) => (
                    <input type="checkbox" checked={r.subscription_active} onChange={(e) => handleSubscriptionToggle(r.id, e.target.checked)} />
                  )},
                ]}
                data={companies}
                searchPlaceholder="Search subscriptions…"
                searchKeys={['name', 'contact_name', 'contact_email']}
                renderActions={(row) => (
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                      onClick={() => { setEditSubscriptionModal(row); setEditSubscriptionForm(row); }}
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                      onClick={() => setDeleteCompanyModal(row)}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                )}
                emptyMessage="No companies"
              />
            </div>
          )}

          {/* Row 2: Users & Access (full width) */}
          <div className="card admin-users-access">
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h3 className="card-title" style={{ marginBottom: 0.25 }}><Users size={20} /> Users & Access</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                  Set role and assign site/department access. Edit row to modify.
                </p>
              </div>
              <button type="button" className="btn btn-primary" onClick={() => setCreateUserModal(true)}>
                <UserPlus size={18} /> Add User
              </button>
            </div>
            <AdminTable
              columns={usersColumns}
              data={profiles}
              searchPlaceholder="Search users…"
              searchKeys={['email', 'role', 'company_name']}
              renderActions={(row) => (
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                    onClick={() => { setEditUserModal(row); if (!profileAccess[row.id]) loadProfileAccess(row.id); }}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                    onClick={() => handleDeleteProfile(row.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
              emptyMessage="No users"
            />
          </div>
        </div>
      )}

      {canCreateUser && !isFullAdmin && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 className="card-title" style={{ marginBottom: 0 }}>Users</h3>
            <button type="button" className="btn btn-primary" onClick={() => setCreateUserModal(true)}>
              <UserPlus size={18} /> Add User
            </button>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 0.5 }}>Add users within your access scope.</p>
        </div>
      )}

      {/* Departments */}
      {isFullAdmin && (
        <div className="admin-sites-depts-grid">
          <div className="card">
            <h3 className="card-title"><FolderTree size={20} /> Departments</h3>
            <form onSubmit={handleAddDepartment} className="admin-form-row" style={{ marginBottom: '1rem' }}>
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
            <AdminTable
              columns={deptsColumns}
              data={departments}
              searchPlaceholder="Search departments…"
              renderActions={(row) => (
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} onClick={() => { setEditDepartmentModal(row); const site = sites.find((s) => s.id === row.site_id); setEditDeptCompanyId(site?.company_id ?? null); setEditDeptSiteId(row.site_id); }}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem' }} onClick={() => handleDeleteDepartment(row.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
              emptyMessage="No departments"
            />
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editUserModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setEditUserModal(null)}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '1.5rem', maxWidth: 480, width: '90%', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3>Edit User</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const f = e.target as HTMLFormElement;
              const displayName = (f.elements.namedItem('displayName') as HTMLInputElement)?.value?.trim();
              const email = (f.elements.namedItem('userEmail') as HTMLInputElement)?.value?.trim();
              const companyIdEl = f.elements.namedItem('userCompanyId') as HTMLSelectElement;
              const companyId = isSuperAdmin && companyIdEl?.value ? parseInt(companyIdEl.value, 10) || null : editUserModal.company_id;
              handleUpdateProfile(editUserModal.id, { display_name: displayName || null, email, company_id: companyId });
            }}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Name</label>
                <input name="displayName" type="text" defaultValue={editUserModal.display_name ?? ''} placeholder="Display name" style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Email</label>
                <input name="userEmail" type="email" defaultValue={editUserModal.email} required style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
              </div>
              {isSuperAdmin && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label>Company</label>
                  <select name="userCompanyId" defaultValue={editUserModal.company_id ?? ''} style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}>
                    <option value="">—</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Role</label>
                <select
                  value={editUserModal.role}
                  onChange={(e) => handleRoleChange(editUserModal.id, e.target.value as Role)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                >
                  <option value="user">User</option>
                  <option value="equipment_manager">Equipment Manager</option>
                  <option value="company_admin">Company Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              {(editUserModal.role === 'user' || editUserModal.role === 'equipment_manager') && (
              <div>
                <label style={{ display: 'block', marginBottom: 0.25, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Access</label>
                <AccessCheckboxes
                  sites={sites}
                  departments={departments}
                  equipment={equipment}
                  access={(profileAccess[editUserModal.id] ?? []).map((a) => ({
                    site_id: a.site_id,
                    department_id: a.department_id,
                    equipment_id: a.equipment_id ?? null,
                  }))}
                  onSave={(rows) => handleSetAccess(editUserModal.id, rows)}
                />
              </div>
            )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditUserModal(null)}>Close</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Site Modal */}
      {editSiteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setEditSiteModal(null)}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '1.5rem', maxWidth: 400, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3>Edit Site</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const siteName = (form.elements.namedItem('siteName') as HTMLInputElement)?.value;
              const companyIdEl = form.elements.namedItem('companyId') as HTMLSelectElement | null;
              const companyId = isSuperAdmin && companyIdEl ? (parseInt(companyIdEl.value || '0', 10) || undefined) : undefined;
              handleUpdateSite(editSiteModal.id, { name: siteName, company_id: companyId });
            }}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Name</label>
                <input name="siteName" type="text" defaultValue={editSiteModal.name} required style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
              </div>
              {isSuperAdmin && companies.length > 0 && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label>Company</label>
                  <select name="companyId" defaultValue={editSiteModal.company_id ?? ''} style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}>
                    <option value="">—</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditSiteModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Department Modal */}
      {editDeptModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setEditDepartmentModal(null)}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '1.5rem', maxWidth: 400, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3>Edit Department</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const name = (form.elements.namedItem('deptName') as HTMLInputElement)?.value;
              const siteId = editDeptSiteId ?? parseInt((form.elements.namedItem('deptSiteId') as HTMLSelectElement)?.value || '0', 10);
              handleUpdateDepartment(editDeptModal.id, { name, site_id: siteId });
            }}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Name</label>
                <input name="deptName" type="text" defaultValue={editDeptModal.name} required style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
              </div>
              {isSuperAdmin && companies.length > 0 && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label>Company</label>
                  <select
                    value={editDeptCompanyId ?? sites.find((s) => s.id === editDeptModal.site_id)?.company_id ?? ''}
                    onChange={(e) => {
                      const cid = e.target.value ? parseInt(e.target.value, 10) : null;
                      setEditDeptCompanyId(cid);
                      const firstInCompany = cid ? sites.find((s) => s.company_id === cid) : null;
                      setEditDeptSiteId(firstInCompany?.id ?? null);
                    }}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                  >
                    <option value="">—</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Site</label>
                <select
                  name="deptSiteId"
                  value={(() => {
                    const deptSites = editDeptCompanyId ? sites.filter((s) => s.company_id === editDeptCompanyId) : sites;
                    const currentId = editDeptSiteId ?? editDeptModal.site_id;
                    const valid = deptSites.some((s) => s.id === currentId);
                    return valid ? currentId : (deptSites[0]?.id ?? currentId);
                  })()}
                  onChange={(e) => setEditDeptSiteId(parseInt(e.target.value, 10))}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                >
                  {(() => {
                    const deptSites = editDeptCompanyId ? sites.filter((s) => s.company_id === editDeptCompanyId) : sites;
                    return (deptSites.length ? deptSites : sites).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} {isSuperAdmin && s.company_name ? `(${s.company_name})` : ''}</option>
                  ));
                  })()}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditDepartmentModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Subscription Modal */}
      {editSubscriptionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setEditSubscriptionModal(null)}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '1.5rem', maxWidth: 480, width: '90%', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3>Edit Company & Subscription</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              handleSaveSubscription(editSubscriptionModal, {
                name: (form.elements.namedItem('subName') as HTMLInputElement)?.value,
                contact_name: (form.elements.namedItem('subContactName') as HTMLInputElement)?.value || null,
                contact_email: (form.elements.namedItem('subContactEmail') as HTMLInputElement)?.value || null,
                contact_phone: (form.elements.namedItem('subContactPhone') as HTMLInputElement)?.value || null,
                address_line1: (form.elements.namedItem('subAddr1') as HTMLInputElement)?.value || null,
                address_line2: (form.elements.namedItem('subAddr2') as HTMLInputElement)?.value || null,
                address_city: (form.elements.namedItem('subCity') as HTMLInputElement)?.value || null,
                address_state: (form.elements.namedItem('subState') as HTMLInputElement)?.value || null,
                address_zip: (form.elements.namedItem('subZip') as HTMLInputElement)?.value || null,
                subscription_level: parseInt((form.elements.namedItem('subLevel') as HTMLSelectElement)?.value || '1', 10),
                subscription_active: (form.elements.namedItem('subActive') as HTMLInputElement)?.checked ?? true,
              });
            }}>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label>Company Name</label>
                <input name="subName" type="text" defaultValue={editSubscriptionForm.name ?? editSubscriptionModal.name} required style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label>Contact Name</label>
                <input name="subContactName" type="text" defaultValue={editSubscriptionForm.contact_name ?? editSubscriptionModal.contact_name ?? ''} style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label>Contact Email</label>
                <input name="subContactEmail" type="email" defaultValue={editSubscriptionForm.contact_email ?? editSubscriptionModal.contact_email ?? ''} style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label>Contact Phone</label>
                <input name="subContactPhone" type="tel" defaultValue={editSubscriptionForm.contact_phone ?? editSubscriptionModal.contact_phone ?? ''} style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label>Address Line 1</label>
                <input name="subAddr1" type="text" defaultValue={editSubscriptionForm.address_line1 ?? editSubscriptionModal.address_line1 ?? ''} style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label>Address Line 2</label>
                <input name="subAddr2" type="text" defaultValue={editSubscriptionForm.address_line2 ?? editSubscriptionModal.address_line2 ?? ''} style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
              </div>
              <div className="admin-address-grid" style={{ marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label>City</label>
                  <input name="subCity" type="text" defaultValue={editSubscriptionForm.address_city ?? editSubscriptionModal.address_city ?? ''} style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input name="subState" type="text" defaultValue={editSubscriptionForm.address_state ?? editSubscriptionModal.address_state ?? ''} style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
                </div>
                <div className="form-group">
                  <label>ZIP</label>
                  <input name="subZip" type="text" defaultValue={editSubscriptionForm.address_zip ?? editSubscriptionModal.address_zip ?? ''} style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Subscription Level</label>
                  <select name="subLevel" defaultValue={editSubscriptionForm.subscription_level ?? editSubscriptionModal.subscription_level ?? 1} style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}>
                    <option value={1}>Level 1</option>
                    <option value={2}>Level 2</option>
                    <option value={3}>Level 3</option>
                    <option value={4}>Level 4</option>
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input name="subActive" type="checkbox" defaultChecked={editSubscriptionForm.subscription_active ?? editSubscriptionModal.subscription_active ?? true} />
                  Active
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-secondary" onClick={() => setEditSubscriptionModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      {addCompanyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setAddCompanyModal(false)}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '1.5rem', maxWidth: 440, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3>Add Company</h3>
            <form onSubmit={handleAddCompany}>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Company Name</label>
                <input type="text" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} required placeholder="Company name" style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Contact Name</label>
                <input type="text" value={newCompanyContactName} onChange={(e) => setNewCompanyContactName(e.target.value)} placeholder="Main contact" style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label>Contact Email</label>
                <input type="email" value={newCompanyContactEmail} onChange={(e) => setNewCompanyContactEmail(e.target.value)} placeholder="contact@company.com" style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={createCompanyWithAdmin} onChange={(e) => setCreateCompanyWithAdmin(e.target.checked)} />
                Create company admin user
              </label>
              {createCompanyWithAdmin && (
                <>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Admin Email</label>
                    <input type="email" value={newCompanyAdminEmail} onChange={(e) => setNewCompanyAdminEmail(e.target.value)} required placeholder="admin@company.com" style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Admin Password</label>
                    <PasswordInput value={newCompanyAdminPassword} onChange={(e) => setNewCompanyAdminPassword(e.target.value)} required placeholder="Min 6 characters" minLength={6} />
                  </div>
                </>
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">Add Company</button>
                <button type="button" className="btn btn-secondary" onClick={() => setAddCompanyModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Company Modal (Super Admin) */}
      {deleteCompanyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDeleteCompanyModal(null)}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '1.5rem', maxWidth: 440, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: 'var(--danger)', marginTop: 0 }}>Delete Company</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Permanently delete "{deleteCompanyModal.name}" and all associated data (sites, departments, equipment, users, calibration records)? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-danger" onClick={() => handleDeleteCompany(deleteCompanyModal)}>Delete</button>
              <button type="button" className="btn btn-secondary" onClick={() => setDeleteCompanyModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Close Company Modal (Company Admin) */}
      {closeCompanyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setCloseCompanyModal(false)}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '1.5rem', maxWidth: 440, width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: 'var(--danger)', marginTop: 0 }}>Close Company & Delete All Data</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              This will permanently delete your company, all sites, departments, equipment, users, and calibration records. Your account will be removed. This cannot be undone.
            </p>
            <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
              Type <strong>{(companyForm.name ?? '').trim() || 'your company name'}</strong> to confirm:
            </p>
            <input
              type="text"
              value={closeCompanyConfirm}
              onChange={(e) => setCloseCompanyConfirm(e.target.value)}
              placeholder="Company name"
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', marginBottom: '1rem' }}
            />
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn btn-danger" onClick={handleCloseCompany} disabled={closingCompany}>
                {closingCompany ? 'Closing…' : 'Close Company & Delete'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setCloseCompanyModal(false); setCloseCompanyConfirm(''); setError(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {createUserModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setCreateUserModal(false)}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '1.5rem', maxWidth: 440, width: '90%', maxHeight: '90vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <h3><Users size={20} style={{ verticalAlign: 'middle', marginRight: 8 }} /> Create User</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Create a new user account. They can sign in with the email and password you set.
            </p>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                />
              </div>
              <div className="form-group">
                <label>Password</label>
                <PasswordInput
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)' }}
                />
              </div>
              {isFullAdmin && (
                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as Role)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                  >
                    <option value="user">User</option>
                    <option value="equipment_manager">Equipment Manager</option>
                    <option value="company_admin">Company Admin</option>
                    {isSuperAdmin && <option value="super_admin">Super Admin</option>}
                  </select>
                </div>
              )}
              {isSuperAdmin && companies.length > 0 && (
                <div className="form-group">
                  <label>Company (for company_admin)</label>
                  <select
                    value={newUserCompanyId}
                    onChange={(e) => setNewUserCompanyId(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                  >
                    <option value="">—</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {(profile?.role === 'equipment_manager' || (isFullAdmin && (newUserRole === 'user' || newUserRole === 'equipment_manager'))) && (
                <div>
                  <label style={{ display: 'block', marginBottom: 0.25, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Access</label>
                  <AccessCheckboxes
                    sites={sites}
                    departments={departments}
                    equipment={equipment}
                    access={newUserAccess}
                    onSave={setNewUserAccess}
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="submit" className="btn btn-primary" disabled={creatingUser}>
                  {creatingUser ? 'Creating…' : 'Create User'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setCreateUserModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
