import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { api } from '../api';

interface Equipment {
  id: number;
  equipment_type_name?: string;
  make: string;
  model: string;
  serial_number: string;
  equipment_number: string | null;
}

export default function RequestEquipment() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [activeSignOuts, setActiveSignOuts] = useState<Set<number>>(new Set());
  const [name, setName] = useState(() => localStorage.getItem('equipment-requester-name') || '');
  const [email, setEmail] = useState(() => localStorage.getItem('equipment-requester-email') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('equipment-requester-phone') || '');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [building, setBuilding] = useState('');
  const [equipmentToTest, setEquipmentToTest] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const [eq, signOuts] = await Promise.all([
        api.equipment.getAll(),
        api.signOuts.getActive(),
      ]);
      setEquipment(eq);
      setActiveSignOuts(new Set(signOuts.map((s: { equipment_id: number }) => s.equipment_id)));
      const available = eq.filter((e: Equipment) => !signOuts.some((s: { equipment_id: number }) => s.equipment_id === e.id));
      if (available.length) setSelectedIds((prev) => (prev.size === 0 ? new Set([available[0].id]) : prev));
    })();
  }, []);

  const availableEquipment = equipment.filter((e) => !activeSignOuts.has(e.id));

  const toggleEquipment = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const validIds = Array.from(selectedIds).filter((id) => availableEquipment.some((e) => e.id === id));
    if (validIds.length === 0) {
      setError('Select at least one available equipment item.');
      return;
    }
    setSubmitting(true);
    try {
      await api.equipmentRequests.create({
        equipment_ids: validIds,
        requester_name: name.trim(),
        requester_email: email.trim(),
        requester_phone: phone.trim(),
        building: building.trim(),
        equipment_number_to_test: equipmentToTest.trim(),
        date_from: dateFrom,
        date_to: dateTo,
      });
      setSuccess(true);
      localStorage.setItem('equipment-requester-name', name.trim());
      localStorage.setItem('equipment-requester-email', email.trim());
      localStorage.setItem('equipment-requester-phone', phone.trim());
      setSelectedIds(new Set());
      setBuilding('');
      setEquipmentToTest('');
      setDateFrom('');
      setDateTo('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div>
      <div className="page-header">
        <h2>Request Equipment</h2>
        <p>Submit a request to use equipment. An equipment manager will review and approve or reject your request.</p>
      </div>

      <div className="card">
        <h3 className="card-title">New Request</h3>
        {success && (
          <div style={{ padding: '1rem', background: 'rgba(34, 197, 94, 0.2)', borderRadius: '8px', marginBottom: '1rem', color: 'var(--success)' }}>
            Request submitted successfully. You will be notified when it is reviewed.
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Your Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Full name" />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="email@example.com" />
            </div>
            <div className="form-group">
              <label>Cell Phone *</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="(555) 123-4567" />
            </div>
          </div>

          <div className="form-group">
            <label>Equipment Requested *</label>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Select one or more items. {selectedIds.size > 0 && `${selectedIds.size} selected`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 200, overflowY: 'auto', padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
              {availableEquipment.map((e) => (
                <label key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.5rem', borderRadius: 6, background: selectedIds.has(e.id) ? 'var(--bg-primary)' : 'transparent' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(e.id)}
                    onChange={() => toggleEquipment(e.id)}
                  />
                  <span style={{ fontSize: '0.9rem' }}>
                    {e.make} {e.model}
                    {e.equipment_number ? ` (#${e.equipment_number})` : ` (S/N: ${e.serial_number})`}
                    {e.equipment_type_name ? ` — ${e.equipment_type_name}` : ''}
                  </span>
                </label>
              ))}
            </div>
            {availableEquipment.length === 0 && equipment.length > 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--warning)', marginTop: '0.5rem' }}>
                All equipment is currently in use. Check back later.
              </p>
            )}
          </div>

          <div className="form-group">
            <label>Building *</label>
            <input value={building} onChange={(e) => setBuilding(e.target.value)} required placeholder="Building where equipment will be used" />
          </div>

          <div className="form-group">
            <label>Equipment Number to Test *</label>
            <input value={equipmentToTest} onChange={(e) => setEquipmentToTest(e.target.value)} required placeholder="e.g. Unit #12, Chamber #5" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Date From *</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} min={today} required />
            </div>
            <div className="form-group">
              <label>Date To *</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} min={dateFrom || today} required />
            </div>
          </div>

          {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting || availableEquipment.length === 0 || selectedIds.size === 0}>
              {submitting ? 'Submitting...' : `Submit Request${selectedIds.size > 0 ? ` (${selectedIds.size} item${selectedIds.size !== 1 ? 's' : ''})` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
