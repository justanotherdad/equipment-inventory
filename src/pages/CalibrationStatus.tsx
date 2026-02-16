import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertTriangle, CheckCircle, Clock, ArrowUpDown } from 'lucide-react';
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

type SortKey = 'status' | 'equipment_type_name' | 'equipment' | 'serial_number' | 'last_calibration_date' | 'next_calibration_due';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'next_calibration_due', label: 'Cal Due Date' },
  { key: 'serial_number', label: 'Serial #' },
  { key: 'status', label: 'Status' },
  { key: 'equipment_type_name', label: 'Type' },
  { key: 'equipment', label: 'Equipment' },
  { key: 'last_calibration_date', label: 'Last Calibration' },
];

const STATUS_ORDER = { due: 0, due_soon: 1, ok: 2, 'n/a': 3 };

export default function CalibrationStatus() {
  const [items, setItems] = useState<CalStatus[]>([]);
  const [filter, setFilter] = useState<'all' | 'due' | 'due_soon' | 'ok' | 'n/a'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('next_calibration_due');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    api.equipment.getCalibrationStatus().then(setItems);
  }, []);

  const filtered = items.filter((i) => {
    if (filter === 'all') return true;
    return i.status === filter;
  });

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'status') {
        cmp = (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4);
      } else if (sortKey === 'equipment_type_name') {
        cmp = (a.equipment_type_name || '').localeCompare(b.equipment_type_name || '');
      } else if (sortKey === 'equipment') {
        const am = `${a.make} ${a.model}`;
        const bm = `${b.make} ${b.model}`;
        cmp = am.localeCompare(bm);
      } else if (sortKey === 'serial_number') {
        cmp = (a.serial_number || '').localeCompare(b.serial_number || '');
      } else if (sortKey === 'last_calibration_date' || sortKey === 'next_calibration_due') {
        const da = (a[sortKey] ? new Date(a[sortKey]!).getTime() : 0);
        const db = (b[sortKey] ? new Date(b[sortKey]!).getTime() : 0);
        cmp = da - db;
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    setSortKey(key);
    setSortAsc((prev) => (sortKey === key ? !prev : true));
  };

  const cycleSortField = () => {
    const idx = SORT_OPTIONS.findIndex((o) => o.key === sortKey);
    setSortKey(SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length].key);
    setSortAsc(true);
  };

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

        <div className="sort-by-mobile">
          <button type="button" className="btn btn-secondary" onClick={cycleSortField}>
            <ArrowUpDown size={16} /> Sort by {SORT_OPTIONS.find((o) => o.key === sortKey)?.label}
          </button>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('status')}>Status {sortKey === 'status' && (sortAsc ? '↑' : '↓')}</th>
                <th className="sortable" onClick={() => handleSort('equipment_type_name')}>Type {sortKey === 'equipment_type_name' && (sortAsc ? '↑' : '↓')}</th>
                <th className="sortable" onClick={() => handleSort('equipment')}>Equipment {sortKey === 'equipment' && (sortAsc ? '↑' : '↓')}</th>
                <th className="sortable" onClick={() => handleSort('serial_number')}>Serial # {sortKey === 'serial_number' && (sortAsc ? '↑' : '↓')}</th>
                <th className="sortable" onClick={() => handleSort('last_calibration_date')}>Last Calibration {sortKey === 'last_calibration_date' && (sortAsc ? '↑' : '↓')}</th>
                <th className="sortable" onClick={() => handleSort('next_calibration_due')}>Next Due {sortKey === 'next_calibration_due' && (sortAsc ? '↑' : '↓')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <tr key={item.id}>
                  <td>{statusBadge(item)}</td>
                  <td>
                    <Link to={`/equipment/${item.id}`} className="link">
                      {item.equipment_type_name}
                    </Link>
                  </td>
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
          {sorted.map((item) => (
            <div key={item.id} className="mobile-card">
              <div className="mobile-card-row">
                <span className="mobile-card-label">Status</span>
                <span className="mobile-card-value">{statusBadge(item)}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Type</span>
                <span className="mobile-card-value">
                  <Link to={`/equipment/${item.id}`} className="link">{item.equipment_type_name}</Link>
                </span>
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
