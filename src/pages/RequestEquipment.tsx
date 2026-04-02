import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../api';

interface EquipmentRow {
  id: number;
  equipment_type_id: number;
  equipment_type_name?: string;
  make: string;
  model: string;
  serial_number: string;
  equipment_number: string | null;
}

interface EquipmentTypeRow {
  id: number;
  name: string;
}

interface CartLine {
  id: string;
  equipment_type_id: number;
  quantity: number;
  preferred_equipment_id: number | null;
}

export default function RequestEquipment() {
  const [equipment, setEquipment] = useState<EquipmentRow[]>([]);
  const [types, setTypes] = useState<EquipmentTypeRow[]>([]);
  const [activeSignOuts, setActiveSignOuts] = useState<Set<number>>(new Set());
  const [sites, setSites] = useState<{ id: number; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ id: number; site_id: number; name: string }[]>([]);
  const [name, setName] = useState(() => localStorage.getItem('equipment-requester-name') || '');
  const [email, setEmail] = useState(() => localStorage.getItem('equipment-requester-email') || '');
  const [phone, setPhone] = useState(() => localStorage.getItem('equipment-requester-phone') || '');
  const [siteId, setSiteId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [building, setBuilding] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [equipmentToTest, setEquipmentToTest] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [lines, setLines] = useState<CartLine[]>([
    { id: '1', equipment_type_id: 0, quantity: 1, preferred_equipment_id: null },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    (async () => {
      const [eq, signOuts, sitesList, typesList, deptList] = await Promise.all([
        api.equipment.getAll() as Promise<EquipmentRow[]>,
        api.signOuts.getActive(),
        api.sites.getAll().catch(() => []),
        api.equipmentTypes.getAll() as Promise<EquipmentTypeRow[]>,
        api.departments.getAll().catch(() => []),
      ]);
      setEquipment(eq);
      setActiveSignOuts(new Set(signOuts.map((s: { equipment_id: number }) => s.equipment_id)));
      setSites(sitesList);
      setTypes(typesList.sort((a, b) => a.name.localeCompare(b.name)));
      setDepartments(deptList as { id: number; site_id: number; name: string }[]);
      setLines((prev) => {
        if (prev.length === 1 && prev[0].equipment_type_id === 0 && typesList[0]) {
          return [{ ...prev[0], equipment_type_id: typesList[0].id }];
        }
        return prev;
      });
    })();
  }, []);

  const departmentsForSite = useMemo(() => {
    if (!siteId) return [];
    const sid = parseInt(siteId, 10);
    return departments.filter((d) => d.site_id === sid).sort((a, b) => a.name.localeCompare(b.name));
  }, [departments, siteId]);

  const availableByType = (typeId: number) =>
    equipment.filter((e) => e.equipment_type_id === typeId && !activeSignOuts.has(e.id));

  const addLine = () => {
    const firstTypeId = types[0]?.id ?? 0;
    setLines((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        equipment_type_id: firstTypeId,
        quantity: 1,
        preferred_equipment_id: null,
      },
    ]);
  };

  const removeLine = (id: string) => {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.id !== id)));
  };

  const updateLine = (id: string, patch: Partial<CartLine>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const validLines = lines
      .map((l) => ({
        equipment_type_id: l.equipment_type_id,
        quantity: Math.max(1, Math.floor(l.quantity)),
        preferred_equipment_id: l.preferred_equipment_id,
      }))
      .filter((l) => l.equipment_type_id > 0);
    if (validLines.length === 0) {
      setError('Add at least one line with an equipment type and quantity.');
      return;
    }
    for (const l of lines) {
      if (l.preferred_equipment_id) {
        const eq = equipment.find((x) => x.id === l.preferred_equipment_id);
        if (!eq || eq.equipment_type_id !== l.equipment_type_id) {
          setError('Preferred asset must match the line equipment type.');
          return;
        }
        if (activeSignOuts.has(l.preferred_equipment_id)) {
          setError('Preferred asset is currently signed out. Clear the preference or pick another.');
          return;
        }
      }
    }
    setSubmitting(true);
    try {
      await api.equipmentRequests.create({
        lines: validLines.map((l) => ({
          equipment_type_id: l.equipment_type_id,
          quantity: l.quantity,
          preferred_equipment_id: l.preferred_equipment_id,
        })),
        requester_name: name.trim(),
        requester_email: email.trim(),
        requester_phone: phone.trim(),
        site_id: siteId ? parseInt(siteId, 10) : null,
        department_id: departmentId ? parseInt(departmentId, 10) : null,
        building: building.trim(),
        room_number: roomNumber.trim() || null,
        equipment_number_to_test: equipmentToTest.trim(),
        date_from: dateFrom,
        date_to: dateTo,
      });
      setSuccess(true);
      localStorage.setItem('equipment-requester-name', name.trim());
      localStorage.setItem('equipment-requester-email', email.trim());
      localStorage.setItem('equipment-requester-phone', phone.trim());
      setLines([{ id: '1', equipment_type_id: types[0]?.id ?? 0, quantity: 1, preferred_equipment_id: null }]);
      setSiteId('');
      setDepartmentId('');
      setBuilding('');
      setRoomNumber('');
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
        <p>
          Build a cart by equipment type and quantity. Optionally pick a preferred asset per line. An equipment manager will approve and assign
          specific units.
        </p>
      </div>

      <div className="card">
        <h3 className="card-title">New Request</h3>
        {success && (
          <div style={{ padding: '1rem', background: 'rgba(34, 197, 94, 0.2)', borderRadius: '8px', marginBottom: '1rem', color: 'var(--success)' }}>
            Request submitted successfully. Managers will see it in the request queue.
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
            <label>Equipment lines *</label>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              Default is type + quantity. Optionally choose a preferred asset (must be available and match the type).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {lines.map((line) => {
                const opts = availableByType(line.equipment_type_id);
                return (
                  <div
                    key={line.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(140px, 1fr) 100px minmax(180px, 1.2fr) auto',
                      gap: '0.5rem',
                      alignItems: 'end',
                      padding: '0.75rem',
                      background: 'var(--bg-tertiary)',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem' }}>Type</label>
                      <select
                        value={line.equipment_type_id || ''}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          updateLine(line.id, {
                            equipment_type_id: v,
                            preferred_equipment_id: null,
                          });
                        }}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                      >
                        <option value="">— Type —</option>
                        {types.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem' }}>Qty</label>
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.id, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.75rem' }}>Preferred asset (optional)</label>
                      <select
                        value={line.preferred_equipment_id ?? ''}
                        onChange={(e) =>
                          updateLine(line.id, {
                            preferred_equipment_id: e.target.value ? parseInt(e.target.value, 10) : null,
                          })
                        }
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                      >
                        <option value="">— No preference —</option>
                        {opts.map((e) => (
                          <option key={e.id} value={e.id}>
                            {[e.make, e.model].filter(Boolean).join(' ')}
                            {e.equipment_number ? ` (#${e.equipment_number})` : e.serial_number ? ` S/N ${e.serial_number}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => removeLine(line.id)}
                      disabled={lines.length <= 1}
                      aria-label="Remove line"
                      style={{ padding: '0.5rem' }}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
            <button type="button" className="btn btn-secondary" style={{ marginTop: '0.75rem' }} onClick={addLine}>
              <Plus size={18} /> Add line
            </button>
          </div>

          {sites.length > 0 && (
            <div className="form-group">
              <label>Site</label>
              <select
                value={siteId}
                onChange={(e) => {
                  setSiteId(e.target.value);
                  setDepartmentId('');
                }}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
              >
                <option value="">— Select site —</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {departmentsForSite.length > 0 && (
            <div className="form-group">
              <label>Department (for routing to managers)</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
              >
                <option value="">— Any department under site —</option>
                {departmentsForSite.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Building *</label>
            <input value={building} onChange={(e) => setBuilding(e.target.value)} required placeholder="Building where equipment will be used" />
          </div>

          <div className="form-group">
            <label>Room Number</label>
            <input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} placeholder="Room or location" />
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
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
