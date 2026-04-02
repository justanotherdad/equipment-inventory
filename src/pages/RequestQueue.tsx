import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, Clock, Package, Zap } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

interface RequestLine {
  id: number;
  equipment_type_id: number;
  equipment_type_name?: string | null;
  quantity: number;
  fulfilled_quantity?: number;
  preferred_equipment_id: number | null;
  preferred_make?: string | null;
  preferred_model?: string | null;
}

interface EquipmentRequest {
  id: number;
  equipment_id: number | null;
  equipment_make?: string;
  equipment_model?: string;
  equipment_serial?: string;
  equipment_number?: string | null;
  requester_name: string;
  requester_email: string;
  requester_phone: string;
  building: string;
  equipment_number_to_test: string;
  date_from: string;
  date_to: string;
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  fulfilled_at?: string | null;
  lines?: RequestLine[];
}

interface EquipmentOpt {
  id: number;
  equipment_type_id: number;
  make: string;
  model: string;
  serial_number: string;
  equipment_number: string | null;
}

type Tab = 'pending' | 'approved' | 'fulfilled' | 'all';

export default function RequestQueue() {
  const { profile } = useAuth();
  const isUser = profile?.role === 'user';
  const canManage =
    profile?.role === 'equipment_manager' || profile?.role === 'company_admin' || profile?.role === 'super_admin';

  const [requests, setRequests] = useState<EquipmentRequest[]>([]);
  const [tab, setTab] = useState<Tab>('pending');
  const [reviewedBy, setReviewedBy] = useState(() => localStorage.getItem('equipment-reviewer-name') || '');
  const [reviewComment, setReviewComment] = useState('');
  const [actingOnId, setActingOnId] = useState<number | null>(null);
  const [equipment, setEquipment] = useState<EquipmentOpt[]>([]);
  const [activeSignOuts, setActiveSignOuts] = useState<Set<number>>(new Set());
  const [fulfillFor, setFulfillFor] = useState<EquipmentRequest | null>(null);
  /** slot key -> equipment id */
  const [fulfillSlots, setFulfillSlots] = useState<Record<string, number | ''>>({});
  const [notifs, setNotifs] = useState<Array<{ id: number; title: string; body: string | null; created_at: string }>>([]);

  const load = async () => {
    const status =
      tab === 'all'
        ? undefined
        : tab === 'pending'
          ? 'pending'
          : tab === 'approved'
            ? 'approved'
            : 'fulfilled';
    const data = (await api.equipmentRequests.getAll(status)) as EquipmentRequest[];
    setRequests(data);
  };

  useEffect(() => {
    load();
  }, [tab]);

  useEffect(() => {
    if (!canManage) return;
    (async () => {
      const [eq, active] = await Promise.all([api.equipment.getAll() as Promise<EquipmentOpt[]>, api.signOuts.getActive()]);
      setEquipment(eq);
      setActiveSignOuts(new Set(active.map((s: { equipment_id: number }) => s.equipment_id)));
    })();
  }, [canManage]);

  const refreshNotifs = async () => {
    if (!canManage) return;
    try {
      const data = await api.notifications.getAll(true);
      setNotifs(data);
    } catch {
      setNotifs([]);
    }
  };

  useEffect(() => {
    refreshNotifs();
  }, [canManage]);

  const pendingRequests = useMemo(() => requests.filter((r) => r.status === 'pending'), [requests]);
  const displayList = useMemo(() => {
    if (tab === 'pending') return pendingRequests;
    return requests;
  }, [tab, requests, pendingRequests]);

  const openFulfill = (r: EquipmentRequest) => {
    setFulfillFor(r);
    const next: Record<string, number | ''> = {};
    if (r.lines) {
      for (const ln of r.lines) {
        const done = ln.fulfilled_quantity ?? 0;
        const need = Math.max(0, ln.quantity - done);
        for (let i = 0; i < need; i++) {
          next[`${ln.id}-${i}`] = '';
        }
      }
    }
    setFulfillSlots(next);
  };

  const submitFulfill = async () => {
    if (!fulfillFor || !reviewedBy.trim()) {
      alert('Enter your name as reviewer.');
      return;
    }
    const fulfillments: { line_id: number; equipment_id: number }[] = [];
    for (const key of Object.keys(fulfillSlots)) {
      const v = fulfillSlots[key];
      if (v === '' || v === undefined) continue;
      const lineId = parseInt(key.split('-')[0], 10);
      fulfillments.push({ line_id: lineId, equipment_id: v as number });
    }
    if (fulfillments.length === 0) {
      alert('Select at least one equipment assignment.');
      return;
    }
    setActingOnId(fulfillFor.id);
    try {
      localStorage.setItem('equipment-reviewer-name', reviewedBy.trim());
      await api.equipmentRequests.fulfill(fulfillFor.id, reviewedBy.trim(), fulfillments);
      setFulfillFor(null);
      await load();
      await refreshNotifs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to fulfill');
    } finally {
      setActingOnId(null);
    }
  };

  const handleApprove = async (id: number) => {
    if (!reviewedBy.trim()) {
      alert('Please enter your name (as reviewer)');
      return;
    }
    setActingOnId(id);
    try {
      localStorage.setItem('equipment-reviewer-name', reviewedBy.trim());
      await api.equipmentRequests.approve(id, reviewedBy.trim());
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActingOnId(null);
    }
  };

  const handleApproveAndFulfill = (r: EquipmentRequest) => {
    openFulfill(r);
  };

  const handleReject = async (id: number) => {
    if (!reviewedBy.trim()) {
      alert('Please enter your name (as reviewer)');
      return;
    }
    setActingOnId(id);
    try {
      localStorage.setItem('equipment-reviewer-name', reviewedBy.trim());
      await api.equipmentRequests.reject(id, reviewedBy.trim(), reviewComment.trim() || undefined);
      load();
      setActingOnId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reject');
      setActingOnId(null);
    }
  };

  const describeRequest = (r: EquipmentRequest) => {
    if (r.lines?.length) {
      return r.lines
        .map(
          (l) =>
            `${l.equipment_type_name ?? `Type #${l.equipment_type_id}`} × ${l.quantity}` +
            (l.preferred_equipment_id ? ` (pref: ${l.preferred_make ?? ''} ${l.preferred_model ?? ''})` : '')
        )
        .join('; ');
    }
    if (r.equipment_id) {
      return (
        <>
          <Link to={`/equipment/${r.equipment_id}`} className="link">
            {r.equipment_make} {r.equipment_model}
            {r.equipment_number ? ` (#${r.equipment_number})` : ` (S/N: ${r.equipment_serial})`}
          </Link>
        </>
      );
    }
    return '—';
  };

  const needsFulfillment = (r: EquipmentRequest) => {
    if (r.status !== 'approved' || !r.lines?.length) return false;
    return r.lines.some((l) => (l.fulfilled_quantity ?? 0) < l.quantity);
  };

  return (
    <div>
      <div className="page-header">
        <h2>{isUser ? 'My Requests' : 'Request Queue'}</h2>
        <p>
          {isUser
            ? 'View your equipment request history'
            : 'Approve (reserves without assigning gear), reject, or fulfill by assigning specific equipment. You can fulfill from pending in one step.'}
        </p>
      </div>

      {canManage && notifs.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 className="card-title">In-app notifications</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {notifs.map((n) => (
              <li
                key={n.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{n.body}</div>}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', flexShrink: 0 }}
                  onClick={async () => {
                    await api.notifications.markRead([n.id]);
                    await refreshNotifs();
                  }}
                >
                  Dismiss
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-secondary" style={{ marginTop: '0.75rem' }} onClick={() => api.notifications.markRead(undefined, true).then(refreshNotifs)}>
            Mark all read
          </button>
        </div>
      )}

      <div className="card">
        {!isUser && (
          <div style={{ marginBottom: '1rem' }}>
            <div className="form-group" style={{ maxWidth: '300px' }}>
              <label>Your Name (as reviewer)</label>
              <input
                value={reviewedBy}
                onChange={(e) => setReviewedBy(e.target.value)}
                placeholder="Equipment manager name"
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button
            className={`btn ${tab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('pending')}
          >
            <Clock size={18} /> Pending ({pendingRequests.length})
          </button>
          {!isUser && (
            <button
              className={`btn ${tab === 'approved' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTab('approved')}
            >
              <Package size={18} /> Approved / partial
            </button>
          )}
          <button
            className={`btn ${tab === 'fulfilled' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('fulfilled')}
          >
            Fulfilled
          </button>
          <button className={`btn ${tab === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('all')}>
            {isUser ? 'All My Requests' : 'All'}
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Requester</th>
                <th>Equipment</th>
                <th>Building</th>
                <th>Equipment to Test</th>
                <th>Dates</th>
                <th>Status</th>
                {tab === 'pending' && !isUser && <th></th>}
                {canManage && tab === 'approved' && <th></th>}
              </tr>
            </thead>
            <tbody>
              {displayList.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div>{r.requester_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.requester_email}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.requester_phone}</div>
                  </td>
                  <td style={{ maxWidth: 280 }}>{describeRequest(r)}</td>
                  <td>{r.building}</td>
                  <td>{r.equipment_number_to_test}</td>
                  <td>
                    {r.date_from} to {r.date_to}
                  </td>
                  <td>
                    <span
                      className={`badge badge-${r.status === 'fulfilled' ? 'ok' : r.status === 'rejected' ? 'due' : 'due-soon'}`}
                    >
                      {r.status}
                      {needsFulfillment(r) ? ' (needs units)' : ''}
                    </span>
                    {r.reviewed_by && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        by {r.reviewed_by}
                        {r.review_comment && r.status === 'rejected' && <div>Comment: {r.review_comment}</div>}
                      </div>
                    )}
                  </td>
                  {tab === 'pending' && !isUser && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {r.lines?.length ? (
                          <>
                            <button
                              className="btn btn-primary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => handleApprove(r.id)}
                              disabled={actingOnId !== null}
                            >
                              <Check size={14} /> Approve
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                              onClick={() => handleApproveAndFulfill(r)}
                              disabled={actingOnId !== null}
                              title="Assign equipment now"
                            >
                              <Zap size={14} /> Fulfill now
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                            onClick={() => handleApprove(r.id)}
                            disabled={actingOnId !== null}
                          >
                            <Check size={14} /> Approve
                          </button>
                        )}
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => handleReject(r.id)}
                          disabled={actingOnId !== null}
                        >
                          <X size={14} /> Reject
                        </button>
                      </div>
                    </td>
                  )}
                  {canManage && tab === 'approved' && (
                    <td>
                      {needsFulfillment(r) && (
                        <button
                          className="btn btn-primary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => openFulfill(r)}
                          disabled={actingOnId !== null}
                        >
                          <Package size={14} /> Assign equipment
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mobile-list">
          {displayList.map((r) => (
            <div key={r.id} className="mobile-card">
              <div className="mobile-card-row">
                <span className="mobile-card-label">Requester</span>
                <span className="mobile-card-value">{r.requester_name}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Equipment</span>
                <span className="mobile-card-value">{describeRequest(r)}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Building</span>
                <span className="mobile-card-value">{r.building}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">To Test</span>
                <span className="mobile-card-value">{r.equipment_number_to_test}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Dates</span>
                <span className="mobile-card-value">
                  {r.date_from} – {r.date_to}
                </span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Status</span>
                <span className="mobile-card-value">
                  <span
                    className={`badge badge-${r.status === 'fulfilled' ? 'ok' : r.status === 'rejected' ? 'due' : 'due-soon'}`}
                  >
                    {r.status}
                  </span>
                </span>
              </div>
              {tab === 'pending' && !isUser && r.status === 'pending' && (
                <div className="mobile-card-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {r.lines?.length ? (
                    <>
                      <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleApprove(r.id)} disabled={actingOnId !== null}>
                        <Check size={14} /> Approve
                      </button>
                      <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handleApproveAndFulfill(r)} disabled={actingOnId !== null}>
                        <Zap size={14} /> Fulfill now
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleApprove(r.id)} disabled={actingOnId !== null}>
                      <Check size={14} /> Approve
                    </button>
                  )}
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleReject(r.id)} disabled={actingOnId !== null}>
                    <X size={14} /> Reject
                  </button>
                </div>
              )}
              {canManage && tab === 'approved' && needsFulfillment(r) && (
                <div className="mobile-card-actions">
                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => openFulfill(r)} disabled={actingOnId !== null}>
                    <Package size={14} /> Assign equipment
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {displayList.length === 0 && (
          <div className="empty-state">
            <p>
              {tab === 'pending'
                ? 'No pending requests.'
                : tab === 'approved'
                  ? 'No approved requests.'
                  : tab === 'fulfilled'
                    ? 'No fulfilled requests yet.'
                    : 'No requests yet.'}
            </p>
          </div>
        )}
      </div>

      {tab === 'pending' && !isUser && (
        <div className="card">
          <h3 className="card-title">Rejection Comment (optional)</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            When rejecting, you can add a comment to explain why. This will be visible to the requester.
          </p>
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="e.g. Equipment is reserved for calibration that week"
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      )}

      {fulfillFor && fulfillFor.lines && (
        <>
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 100,
          }}
          onClick={() => setFulfillFor(null)}
          aria-hidden
        />
        <div
          className="card"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 101,
            width: 'min(560px, calc(100vw - 2rem))',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <h3 className="card-title">Assign equipment</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Request #{fulfillFor.id} — {fulfillFor.requester_name}. Pick available units matching each line type.
          </p>
          {fulfillFor.lines.map((ln) => {
            const done = ln.fulfilled_quantity ?? 0;
            const need = Math.max(0, ln.quantity - done);
            const options = equipment.filter((e) => e.equipment_type_id === ln.equipment_type_id && !activeSignOuts.has(e.id));
            return (
              <div key={ln.id} style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                  {ln.equipment_type_name ?? `Type #${ln.equipment_type_id}`} — need {need} more ({done}/{ln.quantity} assigned)
                </div>
                {Array.from({ length: need }).map((_, i) => {
                  const key = `${ln.id}-${i}`;
                  return (
                    <div key={key} className="form-group" style={{ marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.8rem' }}>Unit {i + 1}</label>
                      <select
                        value={fulfillSlots[key] === '' ? '' : fulfillSlots[key]}
                        onChange={(e) =>
                          setFulfillSlots((prev) => ({
                            ...prev,
                            [key]: e.target.value ? parseInt(e.target.value, 10) : '',
                          }))
                        }
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-primary)',
                          color: 'inherit',
                        }}
                      >
                        <option value="">— Select equipment —</option>
                        {options.map((e) => (
                          <option key={e.id} value={e.id}>
                            {[e.make, e.model].filter(Boolean).join(' ')}
                            {e.equipment_number ? ` (#${e.equipment_number})` : ` S/N ${e.serial_number}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-primary" onClick={submitFulfill} disabled={actingOnId !== null}>
              Confirm assignments
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setFulfillFor(null)}>
              Cancel
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
