import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '../api';

interface Equipment {
  id: number;
  equipment_type_name: string;
  make: string;
  model: string;
  serial_number: string;
  equipment_number: string | null;
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
  preSelectedEquipmentId?: number;
}

export default function SignOutModal({ onClose, onSaved, preSelectedEquipmentId }: Props) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [activeSignOuts, setActiveSignOuts] = useState<Set<number>>(new Set());
  const [equipmentId, setEquipmentId] = useState(preSelectedEquipmentId ?? 0);
  const [signedOutBy, setSignedOutBy] = useState('');
  const [purpose, setPurpose] = useState('');
  const [usageItems, setUsageItems] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const [eq, signOuts] = await Promise.all([
        api.equipment.getAll(),
        api.signOuts.getActive(),
      ]);
      setEquipment(eq);
      const active = new Set(signOuts.map((s) => s.equipment_id));
      setActiveSignOuts(active);
      const available = eq.filter((e) => !active.has(e.id));
      if (preSelectedEquipmentId && available.some((e) => e.id === preSelectedEquipmentId)) {
        setEquipmentId(preSelectedEquipmentId);
      } else if (available.length) {
        setEquipmentId((prev) => (available.some((e) => e.id === prev) ? prev : available[0].id));
      }
    })();
  }, [preSelectedEquipmentId]);

  const availableEquipment = equipment.filter((e) => !activeSignOuts.has(e.id));

  const addUsage = () => setUsageItems((u) => [...u, '']);
  const removeUsage = (i: number) => setUsageItems((u) => u.filter((_, idx) => idx !== i));
  const updateUsage = (i: number, v: string) =>
    setUsageItems((u) => {
      const n = [...u];
      n[i] = v;
      return n;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const result = await api.signOuts.create({
        equipment_id: equipmentId,
        signed_out_by: signedOutBy.trim(),
        purpose: purpose.trim() || undefined,
      });
      const signOutId = (result as { lastInsertRowid: number }).lastInsertRowid;
      for (const sys of usageItems) {
        const trimmed = sys.trim();
        if (trimmed) {
          await api.usage.add({ sign_out_id: signOutId, system_equipment: trimmed });
        }
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h3>Sign Out Equipment</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Equipment</label>
            <select
              value={equipmentId}
              onChange={(e) => setEquipmentId(+e.target.value)}
              required
            >
              <option value={0}>Select equipment...</option>
              {availableEquipment.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.make} {e.model}
                  {e.equipment_number ? ` (#${e.equipment_number})` : ` (S/N: ${e.serial_number})`}
                  {' — '}{e.equipment_type_name}
                </option>
              ))}
            </select>
            {availableEquipment.length === 0 && equipment.length > 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '0.5rem' }}>
                All equipment is currently signed out.
              </p>
            )}
          </div>
          <div className="form-group">
            <label>Signed Out By</label>
            <input value={signedOutBy} onChange={(e) => setSignedOutBy(e.target.value)} required placeholder="Name" />
          </div>
          <div className="form-group">
            <label>Purpose (optional)</label>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Field mapping for Unit #5" />
          </div>
          <div className="form-group">
            <label>Used On / Systems (optional)</label>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Systems or equipment this item will be used to map/test
            </p>
            {usageItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  value={item}
                  onChange={(e) => updateUsage(i, e.target.value)}
                  placeholder="e.g. Temperature Chamber Unit #12"
                  style={{ flex: 1 }}
                />
                <button type="button" className="btn btn-secondary" onClick={() => removeUsage(i)} disabled={usageItems.length === 1}>
                  <X size={16} />
                </button>
              </div>
            ))}
            <button type="button" className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={addUsage}>
              <Plus size={16} /> Add system
            </button>
          </div>
          {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || availableEquipment.length === 0}>
              {saving ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
