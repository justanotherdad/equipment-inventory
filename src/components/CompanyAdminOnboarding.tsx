import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import { Building2, MapPin, Users, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import PasswordInput from './PasswordInput';
import AccessCheckboxes from './AccessCheckboxes';

interface CompanyForm {
  name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  address_line1: string;
  address_line2: string;
  address_city: string;
  address_state: string;
  address_zip: string;
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

const STEPS = [
  { id: 1, title: 'Company Details', icon: Building2 },
  { id: 2, title: 'Site & Department', icon: MapPin },
  { id: 3, title: 'Add Users', icon: Users },
];

const initialCompanyForm: CompanyForm = {
  name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  address_line1: '',
  address_line2: '',
  address_city: '',
  address_state: '',
  address_zip: '',
};

export default function CompanyAdminOnboarding({ onComplete }: { onComplete: () => void }) {
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [companyForm, setCompanyForm] = useState<CompanyForm>(initialCompanyForm);
  const [siteName, setSiteName] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserAccess, setNewUserAccess] = useState<{ site_id: number; department_id: number | null; equipment_id?: number | null }[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const companyId = profile?.company_id ?? null;

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    api.admin.getCompany(companyId)
      .then((c) => {
        setCompanyForm({
          name: c.name ?? '',
          contact_name: c.contact_name ?? '',
          contact_email: c.contact_email ?? '',
          contact_phone: c.contact_phone ?? '',
          address_line1: c.address_line1 ?? '',
          address_line2: c.address_line2 ?? '',
          address_city: c.address_city ?? '',
          address_state: c.address_state ?? '',
          address_zip: c.address_zip ?? '',
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [companyId]);

  const allCompanyFieldsValid = (): boolean => {
    const f = companyForm;
    return !!(
      f.name.trim() &&
      f.contact_name.trim() &&
      f.contact_email.trim() &&
      f.contact_phone.trim() &&
      f.address_line1.trim() &&
      f.address_city.trim() &&
      f.address_state.trim() &&
      f.address_zip.trim()
    );
  };

  const handleStep1Next = async () => {
    if (!allCompanyFieldsValid() || !companyId) {
      setError('All company fields are required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api.admin.updateCompany(companyId, {
        name: companyForm.name.trim(),
        contact_name: companyForm.contact_name.trim(),
        contact_email: companyForm.contact_email.trim(),
        contact_phone: companyForm.contact_phone.trim(),
        address_line1: companyForm.address_line1.trim(),
        address_line2: companyForm.address_line2.trim(),
        address_city: companyForm.address_city.trim(),
        address_state: companyForm.address_state.trim(),
        address_zip: companyForm.address_zip.trim(),
      });
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save company');
    } finally {
      setSaving(false);
    }
  };

  const handleStep2Next = async () => {
    if (!siteName.trim() || !departmentName.trim()) {
      setError('Site name and department name are required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api.admin.createSite(siteName.trim());
      const sitesData = await api.admin.getSites();
      const newSite = sitesData.find((s) => s.name === siteName.trim());
      if (!newSite) throw new Error('Site was created but could not be found');
      await api.admin.createDepartment(newSite.id, departmentName.trim());
      const [depts, eq] = await Promise.all([api.admin.getDepartments(), api.equipment.getAll()]);
      setDepartments(depts);
      setEquipment((eq as Equipment[]) ?? []);
      setSites(sitesData);
      const newDept = depts.find((d) => d.site_id === newSite.id && d.name === departmentName.trim());
      if (newDept) {
        setNewUserAccess([{ site_id: newSite.id, department_id: newDept.id }]);
      }
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create site and department');
    } finally {
      setSaving(false);
    }
  };

  const handleStep3AddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserPassword.trim()) return;
    if (newUserPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await api.admin.createUser(
        newUserEmail.trim(),
        newUserPassword.trim(),
        newUserAccess,
        'user'
      );
      setNewUserEmail('');
      setNewUserPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleStep3Skip = async () => {
    setError('');
    setSaving(true);
    try {
      await api.admin.completeOnboarding();
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete onboarding');
    } finally {
      setSaving(false);
    }
  };

  const handleStep3Finish = async () => {
    setError('');
    setSaving(true);
    try {
      await api.admin.completeOnboarding();
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to complete onboarding');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-primary)',
    color: 'inherit',
    fontSize: '0.95rem',
  };

  const formGroupStyle: React.CSSProperties = { marginBottom: '1rem' };

  if (loading) {
    return (
      <div className="onboarding-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="onboarding-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <p style={{ color: 'var(--danger)' }}>Your account is not linked to a company. Please contact your administrator.</p>
      </div>
    );
  }

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <div className="onboarding-steps">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`onboarding-step-indicator ${step >= s.id ? 'active' : ''} ${step === s.id ? 'current' : ''}`}
            >
              <div className="step-number">{step > s.id ? <Check size={16} /> : s.id}</div>
              <span>{s.title}</span>
              {i < STEPS.length - 1 && <ChevronRight size={16} className="step-arrow" />}
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>
            {step === 1 && 'Company Details'}
            {step === 2 && 'Site & Department'}
            {step === 3 && 'Add Users'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0, textAlign: 'left', lineHeight: 1.5 }}>
            {step === 1 && 'Enter your company information. All fields are required.'}
            {step === 2 && 'Create your first site and department.'}
            {step === 3 && 'Add team members who will use the system. You can skip this step and add users later.'}
          </p>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', borderRadius: 8, marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="onboarding-form">
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div className="form-group" style={formGroupStyle}>
                <label>Company Name *</label>
                <input
                  type="text"
                  value={companyForm.name}
                  onChange={(e) => setCompanyForm((f) => ({ ...f, name: e.target.value }))}
                  style={inputStyle}
                  placeholder="Acme Corp"
                />
              </div>
              <div className="form-group" style={formGroupStyle}>
                <label>Main Contact Name *</label>
                <input
                  type="text"
                  value={companyForm.contact_name}
                  onChange={(e) => setCompanyForm((f) => ({ ...f, contact_name: e.target.value }))}
                  style={inputStyle}
                  placeholder="John Smith"
                />
              </div>
              <div className="form-group" style={formGroupStyle}>
                <label>Contact Email *</label>
                <input
                  type="email"
                  value={companyForm.contact_email}
                  onChange={(e) => setCompanyForm((f) => ({ ...f, contact_email: e.target.value }))}
                  style={inputStyle}
                  placeholder="contact@company.com"
                />
              </div>
              <div className="form-group" style={formGroupStyle}>
                <label>Contact Phone *</label>
                <input
                  type="tel"
                  value={companyForm.contact_phone}
                  onChange={(e) => setCompanyForm((f) => ({ ...f, contact_phone: e.target.value }))}
                  style={inputStyle}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="form-group" style={formGroupStyle}>
                <label>Address Line 1 *</label>
                <input
                  type="text"
                  value={companyForm.address_line1}
                  onChange={(e) => setCompanyForm((f) => ({ ...f, address_line1: e.target.value }))}
                  style={inputStyle}
                  placeholder="123 Main St"
                />
              </div>
              <div className="form-group" style={formGroupStyle}>
                <label>Address Line 2</label>
                <input
                  type="text"
                  value={companyForm.address_line2}
                  onChange={(e) => setCompanyForm((f) => ({ ...f, address_line2: e.target.value }))}
                  style={inputStyle}
                  placeholder="Suite 100"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={formGroupStyle}>
                  <label>City *</label>
                  <input
                    type="text"
                    value={companyForm.address_city}
                    onChange={(e) => setCompanyForm((f) => ({ ...f, address_city: e.target.value }))}
                    style={inputStyle}
                    placeholder="Anytown"
                  />
                </div>
                <div className="form-group" style={formGroupStyle}>
                  <label>State *</label>
                  <input
                    type="text"
                    value={companyForm.address_state}
                    onChange={(e) => setCompanyForm((f) => ({ ...f, address_state: e.target.value }))}
                    style={inputStyle}
                    placeholder="CA"
                  />
                </div>
                <div className="form-group" style={formGroupStyle}>
                  <label>ZIP *</label>
                  <input
                    type="text"
                    value={companyForm.address_zip}
                    onChange={(e) => setCompanyForm((f) => ({ ...f, address_zip: e.target.value }))}
                    style={inputStyle}
                    placeholder="12345"
                  />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-primary" onClick={handleStep1Next} disabled={saving}>
                {saving ? 'Saving…' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-form">
            <div className="form-group" style={formGroupStyle}>
              <label>Site Name *</label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                style={inputStyle}
                placeholder="e.g. Main Office"
              />
            </div>
            <div className="form-group" style={formGroupStyle}>
              <label>Department Name *</label>
              <input
                type="text"
                value={departmentName}
                onChange={(e) => setDepartmentName(e.target.value)}
                style={inputStyle}
                placeholder="e.g. Quality Control"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)} disabled={saving}>
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={handleStep2Next} disabled={saving}>
                {saving ? 'Creating…' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-form" style={{ display: 'block', width: '100%' }}>
            <form onSubmit={handleStep3AddUser} style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
              <div className="form-group" style={formGroupStyle}>
                <label>Email</label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  style={inputStyle}
                  placeholder="user@company.com"
                />
              </div>
              <div className="form-group" style={formGroupStyle}>
                <label>Password (min 6 characters)</label>
                <PasswordInput
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  style={inputStyle}
                  placeholder="••••••••"
                />
              </div>
              {sites.length > 0 && (
                <div className="form-group onboarding-access-section" style={{ ...formGroupStyle, marginTop: '1rem', width: '100%', minWidth: 0 }}>
                  <label>Access</label>
                  <div style={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
                    <AccessCheckboxes
                      sites={sites}
                      departments={departments}
                      equipment={equipment}
                      access={newUserAccess}
                      onSave={setNewUserAccess}
                    />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button type="submit" className="btn btn-primary" disabled={saving || !newUserEmail.trim() || !newUserPassword.trim()}>
                    {saving ? 'Adding…' : 'Add User'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleStep3Finish} disabled={saving}>
                    Done
                  </button>
                  <button type="button" className="btn btn-outline" onClick={handleStep3Skip} disabled={saving}>
                    Skip for now
                  </button>
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => setStep(2)} disabled={saving}>
                  Back
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
