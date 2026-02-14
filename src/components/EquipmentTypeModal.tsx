import { useState, useEffect } from 'react';
import { api } from '../api';

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
  const [name, setName] = useState('');
  const [requiresCalibration, setRequiresCalibration] = useState(true);
  const [frequencyMonths, setFrequencyMonths] = useState<string>('12');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeId) {
      api.equipmentTypes.getAll().then((types) => {
        const t = types.find((x) => x.id === typeId);
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
    }
  }, [typeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        requires_calibration: requiresCalibration,
        calibration_frequency_months: requiresCalibration ? (parseInt(frequencyMonths, 10) || 12) : null,
      };
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
          <div className="form-group">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Temperature Logger" />
          </div>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={requiresCalibration}
                onChange={(e) => setRequiresCalibration(e.target.checked)}
              />
              Requires recurring calibration
            </label>
          </div>
          {requiresCalibration && (
            <div className="form-group">
              <label>Calibration Frequency (months)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={frequencyMonths}
                onChange={(e) => setFrequencyMonths(e.target.value)}
              />
            </div>
          )}
          {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : typeId ? 'Update' : 'Add Type'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
