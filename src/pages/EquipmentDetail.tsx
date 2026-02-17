import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit, FileText, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import EquipmentModal from '../components/EquipmentModal';
import { api } from '../api';

interface Equipment {
  id: number;
  equipment_type_name: string;
  department_name?: string | null;
  site_name?: string | null;
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
  building?: string | null;
  equipment_number_to_test?: string | null;
  date_from?: string | null;
  date_to?: string | null;
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
  cal_date?: string | null;
  due_date?: string | null;
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
  const [addCalDate, setAddCalDate] = useState('');
  const [addDueDate, setAddDueDate] = useState('');

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
      await api.calibrationRecords.add(equipmentId, file, addCalDate || undefined, addDueDate || undefined);
      setAddCalDate('');
      setAddDueDate('');
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload PDF');
    } finally {
      setAddingPdf(false);
      e.target.value = '';
    }
  };

  const handleOpenPdf = async (r: CalRecord) => {
    try {
      await api.calibrationRecords.openInNewTab(r.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to open file');
    }
  };

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
          {(equipment.site_name || equipment.department_name) && (
            <>
              {equipment.site_name && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Site</div>
                  <div>{equipment.site_name}</div>
                </div>
              )}
              {equipment.department_name && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Department</div>
                  <div>{equipment.department_name}</div>
                </div>
              )}
            </>
          )}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h3 className="card-title" style={{ margin: 0 }}>Calibration Records</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="date"
                value={addCalDate}
                onChange={(e) => setAddCalDate(e.target.value)}
                placeholder="Cal date"
                style={{ padding: '0.4rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: '0.875rem' }}
              />
              <input
                type="date"
                value={addDueDate}
                onChange={(e) => setAddDueDate(e.target.value)}
                placeholder="Due date"
                style={{ padding: '0.4rem', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'inherit', fontSize: '0.875rem' }}
              />
            </div>
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
        </div>
        {calRecords.length === 0 ? (
          <div className="empty-state">
            <p>No calibration records. Add PDF scans of calibration certificates.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>File</th>
                  <th>Cal Date</th>
                  <th>Due Date</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {calRecords.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleOpenPdf(r)}
                        className="link"
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', color: 'var(--accent)', fontSize: '1rem' }}
                      >
                        <FileText size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                        {r.file_name}
                      </button>
                    </td>
                    <td>{r.cal_date ? format(new Date(r.cal_date), 'MMM d, yyyy') : '—'}</td>
                    <td>{r.due_date ? format(new Date(r.due_date), 'MMM d, yyyy') : '—'}</td>
                    <td style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{format(new Date(r.uploaded_at), 'MMM d, yyyy')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => handleOpenPdf(r)}>
                          Open
                        </button>
                        <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={() => handleDeleteRecord(r.id)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="card-title">Sign-out History</h3>
        {signOuts.length === 0 ? (
          <div className="empty-state">
            <p>No sign-outs recorded for this equipment.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Signed Out</th>
                    <th>By</th>
                    <th>Building</th>
                    <th>Equipment to Test</th>
                    <th>Dates</th>
                    <th>Signed In</th>
                    <th>Purpose / Used On</th>
                  </tr>
                </thead>
                <tbody>
                  {signOuts.map((s) => (
                    <tr key={s.id}>
                      <td>{format(new Date(s.signed_out_at), 'MMM d, yyyy HH:mm')}</td>
                      <td>{s.signed_out_by}</td>
                      <td>{s.building ?? '—'}</td>
                      <td>{s.equipment_number_to_test ?? '—'}</td>
                      <td>
                        {s.date_from && s.date_to ? `${s.date_from} to ${s.date_to}` : '—'}
                      </td>
                      <td>{s.signed_in_at ? format(new Date(s.signed_in_at), 'MMM d, yyyy HH:mm') : '—'}</td>
                      <td>
                        {s.purpose ?? '—'}
                        {((usagesBySignOut[s.id] ?? []).length > 0) && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            Used on: {(usagesBySignOut[s.id] ?? []).map((u) => u.system_equipment).join(', ')}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-list">
              {signOuts.map((s) => (
                <div key={s.id} className="mobile-card">
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">By</span>
                    <span className="mobile-card-value">{s.signed_out_by}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Out</span>
                    <span className="mobile-card-value">{format(new Date(s.signed_out_at), 'MMM d, yyyy')}</span>
                  </div>
                  {(s.building || s.equipment_number_to_test) && (
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Building / Test</span>
                      <span className="mobile-card-value">{[s.building, s.equipment_number_to_test].filter(Boolean).join(' • ')}</span>
                    </div>
                  )}
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Purpose</span>
                    <span className="mobile-card-value">{s.purpose ?? '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
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
