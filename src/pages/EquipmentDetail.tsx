import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit, FileText, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import EquipmentModal from '../components/EquipmentModal';
import { api } from '../api';

interface Equipment {
  id: number;
  equipment_type_name: string;
  make: string;
  model: string;
  serial_number: string;
  equipment_number: string | null;
  last_calibration_date: string | null;
  next_calibration_due: string | null;
  notes: string | null;
}

interface SignOut {
  id: number;
  signed_out_by: string;
  signed_out_at: string;
  signed_in_by: string | null;
  signed_in_at: string | null;
  purpose: string | null;
}

interface Usage {
  id: number;
  system_equipment: string;
  notes: string | null;
}

interface CalRecord {
  id: number;
  file_name: string;
  file_path?: string;
  download_url?: string;
  uploaded_at: string;
}

export default function EquipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const equipmentId = id ? parseInt(id, 10) : 0;
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [signOuts, setSignOuts] = useState<SignOut[]>([]);
  const [usagesBySignOut, setUsagesBySignOut] = useState<Record<number, Usage[]>>({});
  const [calRecords, setCalRecords] = useState<CalRecord[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [addingPdf, setAddingPdf] = useState(false);

  const load = async () => {
    if (!equipmentId) return;
    const [eq, so, cr] = await Promise.all([
      api.equipment.getById(equipmentId),
      api.signOuts.getByEquipment(equipmentId),
      api.calibrationRecords.getByEquipment(equipmentId),
    ]);
    setEquipment(eq ?? null);
    setSignOuts(so);
    setCalRecords(cr);
    const usages: Record<number, Usage[]> = {};
    for (const s of so) {
      usages[s.id] = await api.usage.getBySignOut(s.id);
    }
    setUsagesBySignOut(usages);
  };

  useEffect(() => {
    load();
  }, [equipmentId]);

  const handleAddPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!equipmentId || addingPdf || !file) return;
    setAddingPdf(true);
    try {
      await api.calibrationRecords.add(equipmentId, file);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload PDF');
    } finally {
      setAddingPdf(false);
      e.target.value = '';
    }
  };

  const getPdfUrl = (r: CalRecord) => api.calibrationRecords.getDownloadUrl(r.id);

  const handleDeleteRecord = async (recordId: number) => {
    if (confirm('Delete this calibration record?')) {
      await api.calibrationRecords.delete(recordId);
      load();
    }
  };

  const handleDeleteEquipment = async () => {
    if (!confirm('Delete this equipment? This cannot be undone.')) return;
    try {
      await api.equipment.delete(equipmentId);
      window.location.href = '/equipment';
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (!equipment) return <div>Loading...</div>;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link to="/equipment" className="link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <ArrowLeft size={18} /> Back to Equipment
          </Link>
          <h2>{equipment.make} {equipment.model}</h2>
          <p>{equipment.equipment_type_name} • {equipment.equipment_number ? `#${equipment.equipment_number}` : `S/N: ${equipment.serial_number}`}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowEdit(true)}>
            <Edit size={18} /> Edit
          </button>
          <button className="btn btn-danger" onClick={handleDeleteEquipment}>
            <Trash2 size={18} /> Delete
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">Details</h3>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Make</div>
            <div>{equipment.make}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Model</div>
            <div>{equipment.model}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Serial Number</div>
            <div>{equipment.serial_number}</div>
          </div>
          {equipment.equipment_number && (
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Equipment Number</div>
              <div>#{equipment.equipment_number}</div>
            </div>
          )}
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Last Calibration</div>
            <div>{equipment.last_calibration_date ? format(new Date(equipment.last_calibration_date), 'MMM d, yyyy') : '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Next Cal Due</div>
            <div>{equipment.next_calibration_due ? format(new Date(equipment.next_calibration_due), 'MMM d, yyyy') : '—'}</div>
          </div>
        </div>
        {equipment.notes && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Notes</div>
            <div>{equipment.notes}</div>
          </div>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Calibration Records</h3>
          <label className="btn btn-primary" style={{ margin: 0, cursor: addingPdf ? 'not-allowed' : 'pointer' }}>
            <Plus size={18} /> Add PDF
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleAddPdf}
              disabled={addingPdf}
              style={{ display: 'none' }}
            />
          </label>
        </div>
        {calRecords.length === 0 ? (
          <div className="empty-state">
            <p>No calibration records. Add PDF scans of calibration certificates.</p>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {calRecords.map((r) => (
              <li key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} color="var(--text-muted)" />
                  <span>{r.file_name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {format(new Date(r.uploaded_at), 'MMM d, yyyy')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <a
                    href={getPdfUrl(r)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', textDecoration: 'none' }}
                  >
                    Open
                  </a>
                  <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => handleDeleteRecord(r.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">Sign-out History</h3>
        {signOuts.length === 0 ? (
          <div className="empty-state">
            <p>No sign-outs recorded for this equipment.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Signed Out</th>
                  <th>By</th>
                  <th>Signed In</th>
                  <th>By</th>
                  <th>Purpose</th>
                  <th>Used On</th>
                </tr>
              </thead>
              <tbody>
                {signOuts.map((s) => (
                  <tr key={s.id}>
                    <td>{format(new Date(s.signed_out_at), 'MMM d, yyyy HH:mm')}</td>
                    <td>{s.signed_out_by}</td>
                    <td>{s.signed_in_at ? format(new Date(s.signed_in_at), 'MMM d, yyyy HH:mm') : '—'}</td>
                    <td>{s.signed_in_by ?? '—'}</td>
                    <td>{s.purpose ?? '—'}</td>
                    <td>
                      {(usagesBySignOut[s.id] ?? []).map((u) => u.system_equipment).join(', ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEdit && (
        <EquipmentModal
          equipmentId={equipmentId}
          onClose={() => setShowEdit(false)}
          onSaved={() => {
            setShowEdit(false);
            load();
          }}
        />
      )}
    </div>
  );
}
