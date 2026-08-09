import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Camera, Edit, FileText, Plus, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import EquipmentModal from '../components/EquipmentModal';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

interface Equipment {
  id: number;
  equipment_type_name: string;
  calibration_frequency_months?: number | null;
  department_name?: string | null;
  site_name?: string | null;
  company_name?: string | null;
  make: string;
  model: string;
  serial_number: string;
  equipment_number: string | null;
  last_calibration_date: string | null;
  next_calibration_due: string | null;
  notes: string | null;
  image_path?: string | null;
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

const dateInputStyle: React.CSSProperties = {
  padding: '0.4rem',
  borderRadius: 6,
  border: '1px solid var(--border)',
  background: 'var(--bg-primary)',
  color: 'inherit',
  fontSize: '0.875rem',
  width: '100%',
  minWidth: '120px',
};

function CalRecordRow({
  record,
  onOpenPdf,
  onDelete,
  onDatesUpdated,
}: {
  record: CalRecord;
  onOpenPdf: () => void;
  onDelete: () => void;
  onDatesUpdated: () => void;
}) {
  const [calDate, setCalDate] = useState(record.cal_date ? record.cal_date.slice(0, 10) : '');
  const [dueDate, setDueDate] = useState(record.due_date ? record.due_date.slice(0, 10) : '');
  const [saving, setSaving] = useState(false);

  const saveDates = async (cal: string, due: string) => {
    if (saving) return;
    setSaving(true);
    try {
      await api.calibrationRecords.update(record.id, {
        cal_date: cal || null,
        due_date: due || null,
      });
      onDatesUpdated();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update dates');
    } finally {
      setSaving(false);
    }
  };

  const handleCalDateChange = (value: string) => {
    setCalDate(value);
    saveDates(value, dueDate);
  };

  const handleDueDateChange = (value: string) => {
    setDueDate(value);
    saveDates(calDate, value);
  };

  return (
    <tr>
      <td>
        <button
          type="button"
          onClick={onOpenPdf}
          className="link"
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', color: 'var(--accent)', fontSize: 'inherit' }}
        >
          <FileText size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
          {record.file_name}
        </button>
      </td>
      <td>
        <input
          type="date"
          value={calDate}
          onChange={(e) => handleCalDateChange(e.target.value)}
          style={dateInputStyle}
          disabled={saving}
          title="Calibration date"
        />
      </td>
      <td>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => handleDueDateChange(e.target.value)}
          style={dateInputStyle}
          disabled={saving}
          title="Due date"
        />
      </td>
      <td style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{format(new Date(record.uploaded_at), 'MMM d, yyyy')}</td>
      <td>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={onOpenPdf}>
            Open
          </button>
          <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }} onClick={onDelete}>
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function EquipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const equipmentId = id ? parseInt(id, 10) : 0;
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [signOuts, setSignOuts] = useState<SignOut[]>([]);
  const [usagesBySignOut, setUsagesBySignOut] = useState<Record<number, Usage[]>>({});
  const [calRecords, setCalRecords] = useState<CalRecord[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [addingPdf, setAddingPdf] = useState(false);
  const [addCalDate, setAddCalDate] = useState('');
  const [addDueDate, setAddDueDate] = useState('');
  // Image state
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageHover, setImageHover] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const loadImage = async (eqId: number) => {
    try {
      const { url } = await api.equipment.getImageUrl(eqId);
      setImageUrl(url);
    } catch {
      setImageUrl(null);
    }
  };

  const load = async () => {
    if (!equipmentId) return;
    const [eq, so, cr] = await Promise.all([
      api.equipment.getById(equipmentId),
      api.signOuts.getByEquipment(equipmentId),
      api.calibrationRecords.getByEquipment(equipmentId),
    ]);
    const eqData = eq as Equipment | null ?? null;
    setEquipment(eqData);
    setSignOuts(so);
    setCalRecords(cr);
    const usages: Record<number, Usage[]> = {};
    for (const s of so) {
      usages[s.id] = await api.usage.getBySignOut(s.id);
    }
    setUsagesBySignOut(usages);
    if (eqData?.image_path) {
      loadImage(equipmentId);
    } else {
      setImageUrl(null);
    }
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!equipmentId || uploadingImage || !file) return;
    setUploadingImage(true);
    try {
      await api.equipment.uploadImage(equipmentId, file);
      await loadImage(equipmentId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleDeleteImage = async () => {
    if (!confirm('Remove this equipment image?')) return;
    try {
      await api.equipment.deleteImage(equipmentId);
      setImageUrl(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove image');
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
          <p>{equipment.equipment_number ? `#${equipment.equipment_number}` : `S/N: ${equipment.serial_number}`}</p>
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
        <div
          style={{ position: 'relative', width: 120, height: 100, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', cursor: imageUrl ? 'zoom-in' : 'pointer', marginBottom: '1rem' }}
          onMouseEnter={() => setImageHover(true)}
          onMouseLeave={() => setImageHover(false)}
          onClick={() => { if (imageUrl) setLightboxOpen(true); }}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="Equipment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
              <img src="/Logo.png" alt="No image" style={{ width: 64, height: 64, objectFit: 'contain', opacity: 0.2, filter: 'grayscale(100%)' }} />
            </div>
          )}
          {imageHover && (
            <div
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', padding: '0.35rem', display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
              onClick={(e) => e.stopPropagation()}
            >
              <label style={{ cursor: uploadingImage ? 'not-allowed' : 'pointer', color: '#fff', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Camera size={13} /> {imageUrl ? 'Change' : 'Upload'}
                <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} style={{ display: 'none' }} />
              </label>
              {imageUrl && (
                <button type="button" onClick={handleDeleteImage} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', padding: 0 }}>
                  <X size={13} /> Remove
                </button>
              )}
            </div>
          )}
        </div>
        <div className="form-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Equipment Type</div>
              <div>{equipment.equipment_type_name}</div>
            </div>
            {isSuperAdmin && equipment.company_name && (
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Company</div>
                <div>{equipment.company_name}</div>
              </div>
            )}
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

      {/* Image lightbox */}
      {lightboxOpen && imageUrl && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={() => setLightboxOpen(false)}
        >
          <button type="button" onClick={() => setLightboxOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={28} />
          </button>
          <img src={imageUrl} alt="Equipment" style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', borderRadius: 8 }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}

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
                  <CalRecordRow
                    key={r.id}
                    record={r}
                    onOpenPdf={() => handleOpenPdf(r)}
                    onDelete={() => handleDeleteRecord(r.id)}
                    onDatesUpdated={load}
                  />
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
