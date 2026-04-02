import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, LogIn, LogOut, ScanBarcode } from 'lucide-react';
import { format } from 'date-fns';
import SignOutModal from '../components/SignOutModal';
import CheckInModal from '../components/CheckInModal';
import BatchCheckoutModal from '../components/BatchCheckoutModal';
import BarcodeScanInput from '../components/BarcodeScanInput';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface SignOut {
  id: number;
  equipment_id: number;
  equipment_make: string;
  equipment_model: string;
  equipment_serial: string;
  equipment_equipment_number?: string | null;
  signed_out_by: string;
  signed_out_at: string;
  signed_in_by: string | null;
  signed_in_at: string | null;
  purpose: string | null;
  date_from?: string | null;
  date_to?: string | null;
}

export default function SignOuts() {
  const { profile } = useAuth();
  const canEditDates = profile?.role === 'equipment_manager' || profile?.role === 'company_admin' || profile?.role === 'super_admin';
  const [activeSignOuts, setActiveSignOuts] = useState<SignOut[]>([]);
  const [allSignOuts, setAllSignOuts] = useState<SignOut[]>([]);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [showSignOut, setShowSignOut] = useState(false);
  const [showBatchCheckout, setShowBatchCheckout] = useState(false);
  const [checkInSignOut, setCheckInSignOut] = useState<SignOut | null>(null);
  const [scanError, setScanError] = useState('');
  const [preSelectedEquipmentId, setPreSelectedEquipmentId] = useState<number | undefined>();
  const [editDates, setEditDates] = useState<SignOut | null>(null);
  const [editDateFrom, setEditDateFrom] = useState('');
  const [editDateTo, setEditDateTo] = useState('');
  const [editSignedOutAt, setEditSignedOutAt] = useState('');
  const [savingDates, setSavingDates] = useState(false);

  const load = async () => {
    const [active, all] = await Promise.all([
      api.signOuts.getActive(),
      api.signOuts.getAll(),
    ]);
    setActiveSignOuts(active);
    setAllSignOuts(all);
  };

  useEffect(() => {
    load();
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
      setCheckInSignOut(activeSignOut);
    } else {
      setPreSelectedEquipmentId(equipment.id);
      setShowSignOut(true);
    }
  };

  const displayList = tab === 'active' ? activeSignOuts : allSignOuts;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Sign-outs</h2>
          <p>Track equipment checked out for field use</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setShowBatchCheckout(true)}>
            <ScanBarcode size={18} />
            Scan & Checkout
          </button>
          <button className="btn btn-secondary" onClick={() => { setPreSelectedEquipmentId(undefined); setShowSignOut(true); }}>
            <Plus size={18} />
            Sign Out Single
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="card-title">Scan with Barcode Scanner</h3>
        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Scan barcode (serial number or equipment number) to quickly sign out or check in. The scanner acts like a keyboard—just scan and the form will open.
        </p>
        <BarcodeScanInput onScan={handleBarcodeScan} />
        {scanError && <p style={{ color: 'var(--danger)', marginTop: '0.75rem', fontSize: '0.9rem' }}>{scanError}</p>}
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <button
            className={`btn ${tab === 'active' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('active')}
          >
            <LogOut size={18} /> Active ({activeSignOuts.length})
          </button>
          <button
            className={`btn ${tab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('history')}
          >
            <LogIn size={18} /> History
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Equipment</th>
                <th>Signed Out</th>
                <th>By</th>
                <th>Purpose</th>
                {tab === 'history' && (
                  <>
                    <th>Signed In</th>
                    <th>By</th>
                  </>
                )}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {displayList.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link to={`/equipment/${s.equipment_id}`} className="link">
                      {s.equipment_make} {s.equipment_model}
                      {s.equipment_equipment_number ? ` (#${s.equipment_equipment_number})` : ` (S/N: ${s.equipment_serial})`}
                    </Link>
                  </td>
                  <td>{format(new Date(s.signed_out_at), 'MMM d, yyyy HH:mm')}</td>
                  <td>{s.signed_out_by}</td>
                  <td>{s.purpose ?? '—'}</td>
                  {tab === 'history' && (
                    <>
                      <td>{s.signed_in_at ? format(new Date(s.signed_in_at), 'MMM d, yyyy HH:mm') : '—'}</td>
                      <td>{s.signed_in_by ?? '—'}</td>
                    </>
                  )}
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {canEditDates && !s.signed_in_at && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => {
                            setEditDates(s);
                            setEditDateFrom((s.date_from ?? '').slice(0, 10));
                            setEditDateTo((s.date_to ?? '').slice(0, 10));
                            setEditSignedOutAt(toDatetimeLocalValue(s.signed_out_at));
                          }}
                        >
                          Edit dates
                        </button>
                      )}
                      {!s.signed_in_at && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => setCheckInSignOut(s)}
                        >
                          <LogIn size={14} /> Check In
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mobile-list">
          {displayList.map((s) => (
            <div key={s.id} className="mobile-card">
              <div className="mobile-card-row">
                <span className="mobile-card-label">Equipment</span>
                <span className="mobile-card-value">
                  <Link to={`/equipment/${s.equipment_id}`} className="link">
                    {s.equipment_make} {s.equipment_model}
                  </Link>
                </span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">By</span>
                <span className="mobile-card-value">{s.signed_out_by}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Out</span>
                <span className="mobile-card-value">{format(new Date(s.signed_out_at), 'MMM d, HH:mm')}</span>
              </div>
              {s.purpose && (
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Purpose</span>
                  <span className="mobile-card-value">{s.purpose}</span>
                </div>
              )}
              <div className="mobile-card-actions">
                {!s.signed_in_at ? (
                  <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setCheckInSignOut(s)}>
                    <LogIn size={14} /> Check In
                  </button>
                ) : (
                  <Link to={`/equipment/${s.equipment_id}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', display: 'flex' }}>
                    View Equipment
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {displayList.length === 0 && (
          <div className="empty-state">
            <p>{tab === 'active' ? 'No equipment currently signed out.' : 'No sign-out history.'}</p>
          </div>
        )}
      </div>

      {showBatchCheckout && (
        <BatchCheckoutModal
          onClose={() => setShowBatchCheckout(false)}
          onSaved={() => {
            setShowBatchCheckout(false);
            load();
          }}
        />
      )}
      {showSignOut && (
        <SignOutModal
          preSelectedEquipmentId={preSelectedEquipmentId}
          onClose={() => { setShowSignOut(false); setPreSelectedEquipmentId(undefined); }}
          onSaved={() => {
            setShowSignOut(false);
            setPreSelectedEquipmentId(undefined);
            load();
          }}
        />
      )}

      {checkInSignOut && (
        <CheckInModal
          signOut={checkInSignOut}
          onClose={() => setCheckInSignOut(null)}
          onSaved={() => {
            setCheckInSignOut(null);
            load();
          }}
        />
      )}

      {editDates && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setEditDates(null)}
        >
          <div className="card" style={{ maxWidth: 420, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <h3 className="card-title">Edit sign-out dates</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Reservation window (used on the equipment heat map) and the recorded sign-out timestamp.
            </p>
            <div className="form-group">
              <label>Date from</label>
              <input type="date" value={editDateFrom} onChange={(e) => setEditDateFrom(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div className="form-group">
              <label>Date to</label>
              <input type="date" value={editDateTo} onChange={(e) => setEditDateTo(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div className="form-group">
              <label>Signed out at (local)</label>
              <input
                type="datetime-local"
                value={editSignedOutAt}
                onChange={(e) => setEditSignedOutAt(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingDates}
                onClick={async () => {
                  setSavingDates(true);
                  try {
                    const d = new Date(editSignedOutAt);
                    await api.signOuts.update(editDates.id, {
                      date_from: editDateFrom || null,
                      date_to: editDateTo || null,
                      signed_out_at: Number.isNaN(d.getTime()) ? undefined : d.toISOString(),
                    });
                    setEditDates(null);
                    load();
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Failed to save');
                  } finally {
                    setSavingDates(false);
                  }
                }}
              >
                {savingDates ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditDates(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
