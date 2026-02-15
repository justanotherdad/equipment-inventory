import { useState, useEffect } from 'react';
import { format, addMonths } from 'date-fns';
import { FileText } from 'lucide-react';
import { api } from '../api';

interface EquipmentType {
  id: number;
  name: string;
  requires_calibration: number;
  calibration_frequency_months: number | null;
}

interface Props {
  equipmentId?: number;
  onClose: () => void;
  onSaved: () => void;
}

export default function EquipmentModal({ equipmentId, onClose, onSaved }: Props) {
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [departments, setDepartments] = useState<{ id: number; site_id: number; name: string; site_name?: string }[]>([]);
  const [form, setForm] = useState({
    equipment_type_id: 0,
    department_id: null as number | null,
    make: '',
    model: '',
    serial_number: '',
    equipment_number: '',
    last_calibration_date: '',
    next_calibration_due: '',
    notes: '',
  });
  const [calibrationFile, setCalibrationFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.equipmentTypes.getAll().then(setTypes);
    api.departments.getAll().then(setDepartments);
  }, []);

  useEffect(() => {
    if (types.length && !form.equipment_type_id) {
      setForm((f) => ({ ...f, equipment_type_id: types[0].id }));
    }
  }, [types]);

  useEffect(() => {
    if (equipmentId) {
      api.equipment.getById(equipmentId).then((e) => {
        if (e) {
          setForm({
            equipment_type_id: e.equipment_type_id,
            department_id: (e as { department_id?: number | null }).department_id ?? null,
            make: e.make,
            model: e.model,
            serial_number: e.serial_number,
            equipment_number: e.equipment_number ?? '',
            last_calibration_date: e.last_calibration_date ? e.last_calibration_date.slice(0, 10) : '',
            next_calibration_due: e.next_calibration_due ? e.next_calibration_due.slice(0, 10) : '',
            notes: e.notes ?? '',
          });
        }
      });
    }
  }, [equipmentId]);

  const currentType = types.find((t) => t.id === form.equipment_type_id);
  const needsCal = currentType?.requires_calibration === 1;
  const calFreq = currentType?.calibration_frequency_months;

  const handleLastCalChange = (date: string) => {
    setForm((f) => {
      const next = date && calFreq ? addMonths(new Date(date), calFreq) : null;
      return {
        ...f,
        last_calibration_date: date,
        next_calibration_due: next ? format(next, 'yyyy-MM-dd') : f.next_calibration_due,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        equipment_type_id: form.equipment_type_id,
        department_id: form.department_id,
        make: form.make.trim(),
        model: form.model.trim(),
        serial_number: form.serial_number.trim(),
        equipment_number: form.equipment_number.trim() || null,
        last_calibration_date: form.last_calibration_date || null,
        next_calibration_due: form.next_calibration_due || null,
        notes: form.notes.trim() || null,
      };
      if (equipmentId) {
        await api.equipment.update(equipmentId, payload);
        if (calibrationFile) {
          await api.calibrationRecords.add(equipmentId, calibrationFile);
        }
      } else {
        const result = await api.equipment.create(payload) as { id: number };
        const newId = result?.id;
        if (newId && calibrationFile) {
          await api.calibrationRecords.add(newId, calibrationFile);
        }
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
          <h3>{equipmentId ? 'Edit Equipment' : 'Add Equipment'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Department</label>
            <select
              value={form.department_id ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value ? parseInt(e.target.value, 10) : null }))}
            >
              <option value="">— Select —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name} {d.site_name ? `(${d.site_name})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Equipment Type</label>
            <select
              value={form.equipment_type_id}
              onChange={(e) => setForm((f) => ({ ...f, equipment_type_id: +e.target.value }))}
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.requires_calibration ? ` (cal every ${t.calibration_frequency_months} mo)` : ' (no cal)'}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Make</label>
              <input value={form.make} onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Model</label>
              <input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Serial Number</label>
              <input value={form.serial_number} onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))} required placeholder="Use N/A if none" />
            </div>
            <div className="form-group">
              <label>Equipment Number (optional)</label>
              <input value={form.equipment_number} onChange={(e) => setForm((f) => ({ ...f, equipment_number: e.target.value }))} placeholder="For barcode when no serial" />
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Barcodes can be serial number or equipment number. Use equipment number for items without a serial.
          </p>
          {needsCal && (
            <div className="form-row">
              <div className="form-group">
                <label>Last Calibration Date</label>
                <input
                  type="date"
                  value={form.last_calibration_date}
                  onChange={(e) => handleLastCalChange(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Next Calibration Due</label>
                <input
                  type="date"
                  value={form.next_calibration_due}
                  onChange={(e) => setForm((f) => ({ ...f, next_calibration_due: e.target.value }))}
                />
              </div>
            </div>
          )}
          <div className="form-group">
            <label>
              <FileText size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
              Calibration Certificate (optional)
            </label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setCalibrationFile(e.target.files?.[0] ?? null)}
              style={{ padding: '0.5rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.875rem' }}
            />
            {calibrationFile && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                {calibrationFile.name}
              </p>
            )}
          </div>
          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : equipmentId ? 'Update' : 'Add Equipment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
