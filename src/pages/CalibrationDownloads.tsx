import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Download, FileText } from 'lucide-react';
import { api } from '../api';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface CalRecord {
  id: number;
  equipment_id: number;
  file_name: string;
  uploaded_at: string;
  equipment_make?: string;
  equipment_model?: string;
  equipment_serial?: string;
  equipment_number?: string | null;
}

export default function CalibrationDownloads() {
  const [records, setRecords] = useState<CalRecord[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.calibrationRecords.getAll().then(setRecords);
  }, []);

  const toggle = (id: number) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === records.length) setSelected(new Set());
    else setSelected(new Set(records.map((r) => r.id)));
  };

  const handleDownloadSelected = async () => {
    if (selected.size === 0) return;
    setDownloading(true);
    try {
      const res = await fetch(`${API_BASE}/api/calibration-records/download-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selected] }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `calibration-certificates-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadOne = (id: number) => {
    window.open(api.calibrationRecords.getDownloadUrl(id), '_blank');
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Download Calibration Certificates</h2>
          <p>Select multiple certificates to download as a zip file</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleDownloadSelected}
          disabled={selected.size === 0 || downloading}
        >
          <Download size={18} />
          Download Selected ({selected.size})
        </button>
      </div>

      <div className="card">
        {records.length === 0 ? (
          <div className="empty-state">
            <p>No calibration certificates on file. Add PDFs from the Equipment detail pages.</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selected.size === records.length}
                  onChange={toggleAll}
                />
                Select all
              </label>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th>Equipment</th>
                    <th>File</th>
                    <th>Uploaded</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggle(r.id)}
                        />
                      </td>
                      <td>
                        <Link to={`/equipment/${r.equipment_id}`} className="link">
                          {r.equipment_make} {r.equipment_model}
                          {r.equipment_number ? ` (#${r.equipment_number})` : r.equipment_serial ? ` (S/N: ${r.equipment_serial})` : ''}
                        </Link>
                      </td>
                      <td>
                        <FileText size={16} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
                        {r.file_name}
                      </td>
                      <td>{format(new Date(r.uploaded_at), 'MMM d, yyyy')}</td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => handleDownloadOne(r.id)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mobile-list">
              {records.map((r) => (
                <div key={r.id} className="mobile-card">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      style={{ marginTop: '0.25rem', flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">Equipment</span>
                        <span className="mobile-card-value">
                          <Link to={`/equipment/${r.equipment_id}`} className="link">
                            {r.equipment_make} {r.equipment_model}
                          </Link>
                        </span>
                      </div>
                      <div className="mobile-card-row">
                        <span className="mobile-card-label">File</span>
                        <span className="mobile-card-value" style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{r.file_name}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mobile-card-actions">
                    <button
                      className="btn btn-secondary"
                      style={{ width: '100%' }}
                      onClick={() => handleDownloadOne(r.id)}
                    >
                      <FileText size={14} /> Open PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
