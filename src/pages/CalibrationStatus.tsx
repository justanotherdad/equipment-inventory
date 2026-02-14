import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { api } from '../api';

interface CalStatus {
  id: number;
  equipment_type_name: string;
  make: string;
  model: string;
  serial_number: string;
  last_calibration_date: string | null;
  next_calibration_due: string | null;
  status: 'due' | 'due_soon' | 'ok' | 'n/a';
  days_until_due: number | null;
}

export default function CalibrationStatus() {
  const [items, setItems] = useState<CalStatus[]>([]);
  const [filter, setFilter] = useState<'all' | 'due' | 'due_soon' | 'ok' | 'n/a'>('all');

  useEffect(() => {
    api.equipment.getCalibrationStatus().then(setItems);
  }, []);

  const filtered = items.filter((i) => {
    if (filter === 'all') return true;
    return i.status === filter;
  });

  const counts = {
    due: items.filter((i) => i.status === 'due').length,
    due_soon: items.filter((i) => i.status === 'due_soon').length,
    ok: items.filter((i) => i.status === 'ok').length,
    n_a: items.filter((i) => i.status === 'n/a').length,
  };

  const statusBadge = (s: CalStatus) => {
    switch (s.status) {
      case 'due':
        return <span className="badge badge-due"><AlertTriangle size={12} /> Overdue</span>;
      case 'due_soon':
        return <span className="badge badge-due-soon"><Clock size={12} /> {s.days_until_due} days</span>;
      case 'ok':
        return <span className="badge badge-ok"><CheckCircle size={12} /> OK</span>;
      default:
        return <span className="badge badge-na">N/A</span>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Calibration Status</h2>
        <p>Track equipment due for recalibration</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button
            className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('all')}
          >
            All ({items.length})
          </button>
          <button
            className={`btn ${filter === 'due' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('due')}
          >
            Overdue ({counts.due})
          </button>
          <button
            className={`btn ${filter === 'due_soon' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('due_soon')}
          >
            Due Soon ({counts.due_soon})
          </button>
          <button
            className={`btn ${filter === 'ok' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('ok')}
          >
            OK ({counts.ok})
          </button>
          <button
            className={`btn ${filter === 'n/a' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('n/a')}
          >
            N/A ({counts.n_a})
          </button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Type</th>
                <th>Equipment</th>
                <th>Serial #</th>
                <th>Last Calibration</th>
                <th>Next Due</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>{statusBadge(item)}</td>
                  <td>{item.equipment_type_name}</td>
                  <td>{item.make} {item.model}</td>
                  <td>{item.serial_number}</td>
                  <td>{item.last_calibration_date ? format(new Date(item.last_calibration_date), 'MMM d, yyyy') : '—'}</td>
                  <td>{item.next_calibration_due ? format(new Date(item.next_calibration_due), 'MMM d, yyyy') : '—'}</td>
                  <td>
                    <Link to={`/equipment/${item.id}`} className="link">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mobile-list">
          {filtered.map((item) => (
            <div key={item.id} className="mobile-card">
              <div className="mobile-card-row">
                <span className="mobile-card-label">Status</span>
                <span className="mobile-card-value">{statusBadge(item)}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Equipment</span>
                <span className="mobile-card-value">{item.make} {item.model}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Serial #</span>
                <span className="mobile-card-value">{item.serial_number}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Next Due</span>
                <span className="mobile-card-value">{item.next_calibration_due ? format(new Date(item.next_calibration_due), 'MMM d, yyyy') : '—'}</span>
              </div>
              <div className="mobile-card-actions">
                <Link to={`/equipment/${item.id}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <p>{items.length === 0 ? 'No equipment in inventory.' : 'No items match this filter.'}</p>
          </div>
        )}
      </div>
    </div>
  );
}
