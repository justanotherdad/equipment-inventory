import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '../api';

interface SignOut {
  id: number;
  equipment_make: string;
  equipment_model: string;
  equipment_serial: string;
}

interface Usage {
  id: number;
  system_equipment: string;
  notes: string | null;
}

interface Props {
  signOut: SignOut;
  onClose: () => void;
  onSaved: () => void;
}

export default function CheckInModal({ signOut, onClose, onSaved }: Props) {
  const [signedInBy, setSignedInBy] = useState('');
  const [usageItems, setUsageItems] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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
      await api.signOuts.checkIn(signOut.id, { signed_in_by: signedInBy.trim() });
      for (const sys of usageItems) {
        const trimmed = sys.trim();
        if (trimmed) {
          await api.usage.add({ sign_out_id: signOut.id, system_equipment: trimmed });
        }
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check in');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h3>Check In Equipment</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          {signOut.equipment_make} {signOut.equipment_model} (S/N: {signOut.equipment_serial})
        </p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Signed In By</label>
            <input value={signedInBy} onChange={(e) => setSignedInBy(e.target.value)} required placeholder="Name" />
          </div>
          <div className="form-group">
            <label>Additional Systems Used On (optional)</label>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Add any systems/equipment used during this sign-out
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
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Checking in...' : 'Check In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
