import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import BarcodeScanInput from './BarcodeScanInput';
import { api } from '../api';

type ScanStatus = 'available' | 'checked_out' | 'out_for_calibration';

interface ScannedItem {
  id: number;
  equipment_type_name: string;
  make: string;
  model: string;
  serial_number: string;
  equipment_number: string | null;
  status: ScanStatus;
  company_name: string | null;
  site_name: string | null;
  site_id: number | null;
  department_name: string | null;
  last_calibration_date: string | null;
  next_calibration_due: string | null;
  notes: string | null;
}

interface BarcodeEquipment {
  id: number;
  equipment_type_name?: string;
  make: string;
  model: string;
  serial_number: string;
  equipment_number?: string | null;
  company_name?: string | null;
  site_name?: string | null;
  site_id?: number | null;
  department_name?: string | null;
  last_calibration_date?: string | null;
  next_calibration_due?: string | null;
  notes?: string | null;
}

interface ActiveSignOut {
  sign_out_type?: 'field_use' | 'calibration' | null;
  purpose?: string | null;
}

const STATUS_LABELS: Record<ScanStatus, string> = {
  available: 'Available',
  checked_out: 'In-Use',
  out_for_calibration: 'Out for Cal',
};

function formatCalDate(value: string | null | undefined): string {
  if (!value) return '—';
  const ymd = value.slice(0, 10);
  const [y, m, d] = ymd.split('-').map((part) => parseInt(part, 10));
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString();
}

function unavailableStatus(signOut: ActiveSignOut): ScanStatus {
  if (signOut.sign_out_type === 'calibration') return 'out_for_calibration';
  if (!signOut.sign_out_type && (signOut.purpose ?? '').toLowerCase().includes('calibration')) {
    return 'out_for_calibration';
  }
  return 'checked_out';
}

interface Site {
  id: number;
  name: string;
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
  /** Pre-populate the checkout list (e.g. from equipment rows selected on the Equipment screen). */
  initialItems?: ScannedItem[];
  /** Optional informational notice shown at the top (e.g. items skipped because already checked out). */
  notice?: string;
}

export default function BatchCheckoutModal({ onClose, onSaved, initialItems, notice }: Props) {
  const [scanned, setScanned] = useState<ScannedItem[]>(initialItems ?? []);
  const [scanError, setScanError] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
  const [signOutType, setSignOutType] = useState<'field_use' | 'calibration'>('field_use');
  const [calVendor, setCalVendor] = useState('');
  const [siteId, setSiteId] = useState<string>('');
  const [building, setBuilding] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [equipmentNumber, setEquipmentNumber] = useState('');
  const [signedOutBy, setSignedOutBy] = useState('');
  const [purpose, setPurpose] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.sites.getAll().then(setSites).catch(() => setSites([]));
  }, []);

  const applyCheckoutDefaults = (item: { site_id: number | null; equipment_number: string | null }) => {
    if (item.site_id != null) {
      setSiteId((current) => (current ? current : String(item.site_id)));
    }
    const number = item.equipment_number?.trim();
    if (number) {
      setEquipmentNumber((current) => (current.trim() ? current : number));
    }
  };

  useEffect(() => {
    const first = (initialItems ?? [])[0];
    if (first) applyCheckoutDefaults(first);
    // Prefill once from items already chosen. Later edits stay as the user left them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBarcodeScan = async (barcode: string) => {
    setScanError('');
    const equipment = (await api.equipment.getByBarcode(barcode)) as BarcodeEquipment | null;
    if (!equipment) {
      setScanError(`No equipment found for "${barcode}". Check serial number or equipment number.`);
      return;
    }
    const activeSignOut = (await api.signOuts.getActiveByEquipmentId(equipment.id)) as ActiveSignOut | null;
    if (activeSignOut) {
      const label = STATUS_LABELS[unavailableStatus(activeSignOut)];
      const identity = equipment.equipment_number
        ? `#${equipment.equipment_number}`
        : equipment.serial_number;
      setScanError(`Equipment ${identity} is ${label} and cannot be checked out.`);
      return;
    }
    if (scanned.some((s) => s.id === equipment.id)) {
      setScanError(`"${equipment.serial_number}" is already in the list.`);
      return;
    }
    const item: ScannedItem = {
      id: equipment.id,
      equipment_type_name: equipment.equipment_type_name ?? '',
      make: equipment.make,
      model: equipment.model,
      serial_number: equipment.serial_number,
      equipment_number: equipment.equipment_number ?? null,
      status: 'available',
      company_name: equipment.company_name ?? null,
      site_name: equipment.site_name ?? null,
      site_id: equipment.site_id ?? null,
      department_name: equipment.department_name ?? null,
      last_calibration_date: equipment.last_calibration_date ?? null,
      next_calibration_due: equipment.next_calibration_due ?? null,
      notes: equipment.notes ?? null,
    };
    setScanned((prev) => [...prev, item]);
    applyCheckoutDefaults(item);
  };

  const removeItem = (id: number) => {
    setScanned((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (scanned.length === 0) {
      setError('Scan at least one equipment barcode.');
      return;
    }
    if (!signedOutBy.trim()) {
      setError('User (signed out by) is required.');
      return;
    }
    setSaving(true);
    try {
      await api.checkouts.create({
        equipment_ids: scanned.map((s) => s.id),
        site_id: signOutType === 'field_use' && siteId ? parseInt(siteId, 10) : null,
        building: signOutType === 'field_use' ? (building.trim() || null) : null,
        room_number: signOutType === 'field_use' ? (roomNumber.trim() || null) : null,
        equipment_number_to_test: signOutType === 'field_use' ? (equipmentNumber.trim() || null) : null,
        signed_out_by: signedOutBy.trim(),
        purpose: signOutType === 'field_use' ? (purpose.trim() || null) : null,
        sign_out_type: signOutType,
        cal_vendor: signOutType === 'calibration' ? (calVendor.trim() || null) : null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checkout');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px', maxHeight: '90vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h3>Scan & Checkout</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Scan equipment barcodes (1 or many), then add the checkout details below.
        </p>

        {notice && (
          <p
            style={{
              color: 'var(--warning)',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-tertiary)',
              borderRadius: 8,
            }}
          >
            {notice}
          </p>
        )}

        {/* Reason selector */}
        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>Sign-out Reason</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className={`btn ${signOutType === 'field_use' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setSignOutType('field_use')}
            >
              Field Use
            </button>
            <button
              type="button"
              className={`btn ${signOutType === 'calibration' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1 }}
              onClick={() => setSignOutType('calibration')}
            >
              Calibration
            </button>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>Scan Barcode</label>
          <BarcodeScanInput onScan={handleBarcodeScan} placeholder="Scan or type barcode and press Enter" />
          {scanError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{scanError}</p>}
        </div>

        {scanned.length > 0 && (
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Scanned Equipment ({scanned.length})</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 320, overflowY: 'auto', padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
              {scanned.map((s) => (
                <div key={s.id} style={{ padding: '0.65rem 0.75rem', background: 'var(--bg-primary)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <strong style={{ fontSize: '0.95rem' }}>
                      {s.make} {s.model}
                      {s.equipment_number ? ` (#${s.equipment_number})` : ''}
                    </strong>
                    <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => removeItem(s.id)} aria-label="Remove scanned equipment">
                      <X size={14} />
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: '0.2rem' }}>
                    <ScanDetail label="Status" value={STATUS_LABELS[s.status]} />
                    <ScanDetail label="Equipment Type" value={s.equipment_type_name || '—'} />
                    <ScanDetail label="Company" value={s.company_name || '—'} />
                    <ScanDetail label="Site" value={s.site_name || '—'} />
                    <ScanDetail label="Department" value={s.department_name || '—'} />
                    <ScanDetail label="Serial Number" value={s.serial_number || '—'} />
                    <ScanDetail label="Equipment Number" value={s.equipment_number ? `#${s.equipment_number}` : '—'} />
                    <ScanDetail label="Last Calibration" value={formatCalDate(s.last_calibration_date)} />
                    <ScanDetail label="Next Cal Due" value={formatCalDate(s.next_calibration_due)} />
                    <ScanDetail label="Notes" value={s.notes?.trim() || '—'} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>User (signed out by) *</label>
            <input
              value={signedOutBy}
              onChange={(e) => setSignedOutBy(e.target.value)}
              required
              placeholder="Name of person receiving equipment"
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
            />
          </div>

          {signOutType === 'calibration' && (
            <div className="form-group">
              <label>Vendor / Lab (optional)</label>
              <input
                value={calVendor}
                onChange={(e) => setCalVendor(e.target.value)}
                placeholder="e.g. Acme Calibration Lab"
                style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
              />
            </div>
          )}

          {signOutType === 'field_use' && (
            <>
              {sites.length > 0 && (
                <div className="form-group">
                  <label>Site</label>
                  <select
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                  >
                    <option value="">— Select site —</option>
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Building</label>
                <input
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  placeholder="Building name or number"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                />
              </div>
              <div className="form-group">
                <label>Room Number</label>
                <input
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="Room or location"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                />
              </div>
              <div className="form-group">
                <label>Equipment Number (to test)</label>
                <input
                  value={equipmentNumber}
                  onChange={(e) => setEquipmentNumber(e.target.value)}
                  placeholder="Equipment # at the site"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                />
              </div>
              <div className="form-group">
                <label>Purpose (optional)</label>
                <input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Field mapping"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
                />
              </div>
            </>
          )}
          {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || scanned.length === 0}>
              {saving ? 'Creating...' : `Check Out ${scanned.length} Item${scanned.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ScanDetail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.85rem' }}>
      <span style={{ color: 'var(--text-muted)', minWidth: 132, flexShrink: 0 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
