import { useState, useEffect } from 'react';
import { api } from '../api';

interface Props {
  equipmentIds: number[];
  onClose: () => void;
  onSaved: () => void;
}

export default function BulkEditModal({ equipmentIds, onClose, onSaved }: Props) {
  const [types, setTypes] = useState<{ id: number; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; site_id: number; name: string; site_name?: string }[]>([]);
  const [form, setForm] = useState({
    equipment_type_id: '' as number | '',
    department_id: '' as number | '',
    make: '',
    model: '',
    serial_number: '',
    equipment_number: '',
    last_calibration_date: '',
    next_calibration_due: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.equipmentTypes.getAll().then((t) => setTypes(t as { id: number; name: string }[]));
    api.departments.getAll().then((d) => setDepartments(d as { id: number; site_id: number; name: string; site_name?: string }[]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      if (form.equipment_type_id) payload.equipment_type_id = form.equipment_type_id;
      if (form.department_id !== '') payload.department_id = form.department_id || null;
      if (form.make.trim()) payload.make = form.make.trim();
      if (form.model.trim()) payload.model = form.model.trim();
      if (form.serial_number.trim()) payload.serial_number = form.serial_number.trim();
      if (form.equipment_number.trim() !== '') payload.equipment_number = form.equipment_number.trim() || null;
      if (form.last_calibration_date) payload.last_calibration_date = form.last_calibration_date;
      if (form.next_calibration_due) payload.next_calibration_due = form.next_calibration_due;
      if (form.notes.trim() !== '') payload.notes = form.notes.trim() || null;
      if (Object.keys(payload).length === 0) {
        setError('Change at least one field');
        setSaving(false);
        return;
      }
      await api.equipment.bulkUpdate(equipmentIds, payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Bulk Edit ({equipmentIds.length} items)</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Only filled fields will be updated. Leave blank to keep current values.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Department</label>
            <select
              value={form.department_id}
              onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value ? parseInt(e.target.value, 10) : '' }))}
            >
              <option value="">— No change —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} {d.site_name ? `(${d.site_name})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Equipment Type</label>
            <select
              value={form.equipment_type_id}
              onChange={(e) => setForm((f) => ({ ...f, equipment_type_id: e.target.value ? parseInt(e.target.value, 10) : '' }))}
            >
              <option value="">— No change —</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Make</label>
              <input value={form.make} onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))} placeholder="No change" />
            </div>
            <div className="form-group">
              <label>Model</label>
              <input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="No change" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Serial Number</label>
              <input value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} placeholder="No change" />
            </div>
            <div className="form-group">
              <label>Equipment Number</label>
              <input value={form.equipment_number} onChange={(e) => setForm((f) => ({ ...f, equipment_number: e.target.value }))} placeholder="No change" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Last Calibration Date</label>
              <input type="date" value={form.last_calibration_date} onChange={(e) => setForm((f) => ({ ...f, last_calibration_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Next Calibration Due</label>
              <input type="date" value={form.next_calibration_due} onChange={(e) => setForm((f) => ({ ...f, next_calibration_due: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="No change" />
          </div>
          {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Update Selected'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
