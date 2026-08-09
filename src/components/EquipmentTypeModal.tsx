import { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useCompanyScope } from '../contexts/CompanyScopeContext';

interface EquipmentType {
  id: number;
  name: string;
  requires_calibration: number;
  calibration_frequency_months: number | null;
}

interface Props {
  typeId: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EquipmentTypeModal({ typeId, onClose, onSaved }: Props) {
  const { profile } = useAuth();
  const { companyId: scopeCompanyId, companies } = useCompanyScope();
  const isSuperAdmin = profile?.role === 'super_admin';
  const [name, setName] = useState('');
  const [requiresCalibration, setRequiresCalibration] = useState(true);
  const [frequencyMonths, setFrequencyMonths] = useState<string>('12');
  const [companyId, setCompanyId] = useState<number | ''>(scopeCompanyId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (scopeCompanyId != null) setCompanyId(scopeCompanyId);
  }, [scopeCompanyId]);

  useEffect(() => {
    if (typeId) {
      api.equipmentTypes.getAll().then((types) => {
        const list = types as EquipmentType[];
        const t = list.find((x) => x.id === typeId);
        if (t) {
          setName(t.name);
          setRequiresCalibration(t.requires_calibration === 1);
          setFrequencyMonths(t.calibration_frequency_months != null ? String(t.calibration_frequency_months) : '12');
        }
      });
    } else {
      setName('');
      setRequiresCalibration(true);
      setFrequencyMonths('12');
      setCompanyId(scopeCompanyId ?? '');
    }
  }, [typeId, scopeCompanyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!typeId && isSuperAdmin && companyId === '') {
      setError('Select a company for this equipment type');
      return;
    }
    setSaving(true);
    try {
      const payload: {
        name: string;
        requires_calibration: boolean;
        calibration_frequency_months: number | null;
        company_id?: number;
      } = {
        name: name.trim(),
        requires_calibration: requiresCalibration,
        calibration_frequency_months: requiresCalibration ? (parseInt(frequencyMonths, 10) || 12) : null,
      };
      if (!typeId && isSuperAdmin && companyId !== '') {
        payload.company_id = companyId;
      }
      if (typeId) {
        await api.equipmentTypes.update(typeId, payload);
      } else {
        await api.equipmentTypes.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{typeId ? 'Edit Equipment Type' : 'Add Equipment Type'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {!typeId && isSuperAdmin && (
            <div className="form-group">
              <label>Company</label>
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value ? parseInt(e.target.value, 10) : '')}
                required
                disabled={scopeCompanyId != null}
              >
                <option value="">Select company…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Temperature Logger" />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flexWrap: 'wrap', wordBreak: 'break-word' }}>
              <input
                type="checkbox"
                checked={requiresCalibration}
                onChange={(e) => setRequiresCalibration(e.target.checked)}
              />
              Requires calibration
            </label>
          </div>
          {requiresCalibration && (
            <div className="form-group">
              <label>Calibration frequency (months)</label>
              <input
                type="number"
                min={1}
                value={frequencyMonths}
                onChange={(e) => setFrequencyMonths(e.target.value)}
                required
              />
            </div>
          )}
          {error && <p style={{ color: 'var(--danger)', marginBottom: '0.75rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : typeId ? 'Save' : 'Add Type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
