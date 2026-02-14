import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Check, X, Clock } from 'lucide-react';
import { api } from '../api';

interface EquipmentRequest {
  id: number;
  equipment_id: number;
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
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
}

export default function RequestQueue() {
  const [requests, setRequests] = useState<EquipmentRequest[]>([]);
  const [tab, setTab] = useState<'pending' | 'all'>('pending');
  const [reviewedBy, setReviewedBy] = useState(() => localStorage.getItem('equipment-reviewer-name') || '');
  const [reviewComment, setReviewComment] = useState('');
  const [actingOnId, setActingOnId] = useState<number | null>(null);

  const load = async () => {
    const data = await api.equipmentRequests.getAll(tab === 'pending' ? 'pending' : undefined);
    setRequests(data);
  };

  useEffect(() => {
    load();
  }, [tab]);

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const displayList = tab === 'pending' ? pendingRequests : requests;

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
      setActingOnId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to approve');
      setActingOnId(null);
    }
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

  return (
    <div>
      <div className="page-header">
        <h2>Request Queue</h2>
        <p>Review and approve or reject equipment requests</p>
      </div>

      <div className="card">
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

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button
            className={`btn ${tab === 'pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('pending')}
          >
            <Clock size={18} /> Pending ({pendingRequests.length})
          </button>
          <button
            className={`btn ${tab === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab('all')}
          >
            All Requests
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
                {tab === 'pending' && <th></th>}
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
                  <td>
                    <Link to={`/equipment/${r.equipment_id}`} className="link">
                      {r.equipment_make} {r.equipment_model}
                      {r.equipment_number ? ` (#${r.equipment_number})` : ` (S/N: ${r.equipment_serial})`}
                    </Link>
                  </td>
                  <td>{r.building}</td>
                  <td>{r.equipment_number_to_test}</td>
                  <td>{r.date_from} to {r.date_to}</td>
                  <td>
                    <span className={`badge badge-${r.status === 'approved' ? 'ok' : r.status === 'rejected' ? 'due' : 'due-soon'}`}>
                      {r.status}
                    </span>
                    {r.reviewed_by && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        by {r.reviewed_by}
                        {r.review_comment && r.status === 'rejected' && (
                          <div>Comment: {r.review_comment}</div>
                        )}
                      </div>
                    )}
                  </td>
                  {tab === 'pending' && (
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => handleApprove(r.id)}
                          disabled={actingOnId !== null}
                        >
                          <Check size={14} /> Approve
                        </button>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {displayList.length === 0 && (
          <div className="empty-state">
            <p>{tab === 'pending' ? 'No pending requests.' : 'No requests yet.'}</p>
          </div>
        )}
      </div>

      {tab === 'pending' && (
        <div className="card">
          <h3 className="card-title">Rejection Comment (optional)</h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            When rejecting, you can add a comment to explain why. This will be visible to the requester.
          </p>
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="e.g. Equipment is reserved for calibration that week"
            style={{ width: '100%', minHeight: '80px', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          />
        </div>
      )}
    </div>
  );
}
