import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import BarcodeScanInput from './BarcodeScanInput';
import { api } from '../api';

interface ScannedItem {
  id: number;
  equipment_type_name: string;
  make: string;
  model: string;
  serial_number: string;
  equipment_number: string | null;
}

interface Site {
  id: number;
  name: string;
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function BatchCheckoutModal({ onClose, onSaved }: Props) {
  const [scanned, setScanned] = useState<ScannedItem[]>([]);
  const [scanError, setScanError] = useState('');
  const [sites, setSites] = useState<Site[]>([]);
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

  const handleBarcodeScan = async (barcode: string) => {
    setScanError('');
    const equipment = await api.equipment.getByBarcode(barcode);
    if (!equipment) {
      setScanError(`No equipment found for "${barcode}". Check serial number or equipment number.`);
      return;
    }
    const activeSignOut = await api.signOuts.getActiveByEquipmentId(equipment.id);
    if (activeSignOut) {
      setScanError(`Equipment "${equipment.serial_number}" is already signed out.`);
      return;
    }
    if (scanned.some((s) => s.id === equipment.id)) {
      setScanError(`"${equipment.serial_number}" is already in the list.`);
      return;
    }
    setScanned((prev) => [
      ...prev,
      {
        id: equipment.id,
        equipment_type_name: equipment.equipment_type_name ?? '',
        make: equipment.make,
        model: equipment.model,
        serial_number: equipment.serial_number,
        equipment_number: equipment.equipment_number ?? null,
      },
    ]);
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
        site_id: siteId ? parseInt(siteId, 10) : null,
        building: building.trim() || null,
        room_number: roomNumber.trim() || null,
        equipment_number_to_test: equipmentNumber.trim() || null,
        signed_out_by: signedOutBy.trim(),
        purpose: purpose.trim() || null,
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

        <div className="form-group" style={{ marginBottom: '1rem' }}>
          <label>Scan Barcode</label>
          <BarcodeScanInput onScan={handleBarcodeScan} placeholder="Scan or type barcode and press Enter" />
          {scanError && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{scanError}</p>}
        </div>

        {scanned.length > 0 && (
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Scanned Equipment ({scanned.length})</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 160, overflowY: 'auto', padding: '0.5rem', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
              {scanned.map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: 6 }}>
                  <span style={{ fontSize: '0.9rem' }}>
                    {s.make} {s.model}
                    {s.equipment_number ? ` (#${s.equipment_number})` : ` (S/N: ${s.serial_number})`}
                  </span>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={() => removeItem(s.id)}>
                    <X size={14} />
                  </button>
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
              placeholder="e.g. Field mapping, calibration"
              style={{ width: '100%', padding: '0.5rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit' }}
            />
          </div>
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
