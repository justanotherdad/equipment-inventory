import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit3, ArrowUpDown } from 'lucide-react';
import EquipmentModal from '../components/EquipmentModal';
import BulkEditModal from '../components/BulkEditModal';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';

interface Equipment {
  id: number;
  equipment_type_id?: number;
  department_id?: number | null;
  equipment_type_name: string;
  make: string;
  model: string;
  serial_number: string;
  equipment_number: string | null;
  last_calibration_date: string | null;
  next_calibration_due: string | null;
}

type SortKey = 'equipment_type_name' | 'make' | 'model' | 'serial_number' | 'last_calibration_date' | 'next_calibration_due';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'serial_number', label: 'Serial #' },
  { key: 'equipment_type_name', label: 'Type' },
  { key: 'make', label: 'Make' },
  { key: 'model', label: 'Model' },
  { key: 'last_calibration_date', label: 'Last Cal' },
  { key: 'next_calibration_due', label: 'Next Cal Due' },
];

export default function EquipmentList() {
  const { profile } = useAuth();
  const canEdit = profile?.role === 'equipment_manager' || profile?.role === 'company_admin' || profile?.role === 'super_admin';
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('serial_number');
  const [sortAsc, setSortAsc] = useState(true);

  const load = async () => {
    const data = await api.equipment.getAll();
    setEquipment(data);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = equipment.filter(
    (e) =>
      !filter ||
      e.make.toLowerCase().includes(filter.toLowerCase()) ||
      e.model.toLowerCase().includes(filter.toLowerCase()) ||
      e.serial_number.toLowerCase().includes(filter.toLowerCase()) ||
      (e.equipment_number?.toLowerCase().includes(filter.toLowerCase()) ?? false) ||
      e.equipment_type_name?.toLowerCase().includes(filter.toLowerCase())
  );

  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (sortKey === 'last_calibration_date' || sortKey === 'next_calibration_due') {
        const da = av ? new Date(av as string).getTime() : 0;
        const db = bv ? new Date(bv as string).getTime() : 0;
        cmp = da - db;
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''));
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

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((e) => e.id)));
  };

  const handleBulkSaved = () => {
    setShowBulkModal(false);
    setSelectedIds(new Set());
    load();
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Equipment</h2>
          <p>Manage your equipment inventory</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canEdit && selectedIds.size > 0 && (
            <button className="btn btn-secondary" onClick={() => setShowBulkModal(true)}>
              <Edit3 size={18} />
              Edit {selectedIds.size} selected
            </button>
          )}
          {canEdit && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={18} />
              Add Equipment
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="form-group" style={{ marginBottom: '1rem', position: 'relative', maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by make, model, serial number, or type..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
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
                {canEdit && (
                  <th style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      ref={(el) => { if (el) el.indeterminate = filtered.length > 0 && selectedIds.size > 0 && selectedIds.size < filtered.length; }}
                      onChange={toggleSelectAll}
                    />
                  </th>
                )}
                <th className="sortable" onClick={() => handleSort('equipment_type_name')}>Type {sortKey === 'equipment_type_name' && (sortAsc ? '↑' : '↓')}</th>
                <th className="sortable" onClick={() => handleSort('make')}>Make {sortKey === 'make' && (sortAsc ? '↑' : '↓')}</th>
                <th className="sortable" onClick={() => handleSort('model')}>Model {sortKey === 'model' && (sortAsc ? '↑' : '↓')}</th>
                <th className="sortable" onClick={() => handleSort('serial_number')}>Serial / Equip # {sortKey === 'serial_number' && (sortAsc ? '↑' : '↓')}</th>
                <th className="sortable" onClick={() => handleSort('last_calibration_date')}>Last Cal {sortKey === 'last_calibration_date' && (sortAsc ? '↑' : '↓')}</th>
                <th className="sortable" onClick={() => handleSort('next_calibration_due')}>Next Cal Due {sortKey === 'next_calibration_due' && (sortAsc ? '↑' : '↓')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.id}>
                  {canEdit && (
                    <td>
                      <input type="checkbox" checked={selectedIds.has(e.id)} onChange={() => toggleSelect(e.id)} />
                    </td>
                  )}
                  <td>
                    <Link to={`/equipment/${e.id}`} className="link">
                      {e.equipment_type_name}
                    </Link>
                  </td>
                  <td>{e.make}</td>
                  <td>{e.model}</td>
                  <td>{e.equipment_number ? `#${e.equipment_number}` : e.serial_number}</td>
                  <td>{formatDate(e.last_calibration_date)}</td>
                  <td>{formatDate(e.next_calibration_due)}</td>
                  <td>
                    <Link to={`/equipment/${e.id}`} className="link">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mobile-list">
          {sorted.map((e) => (
            <div key={e.id} className="mobile-card">
              {canEdit && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <input type="checkbox" checked={selectedIds.has(e.id)} onChange={() => toggleSelect(e.id)} /> Select
                </div>
              )}
              <div className="mobile-card-row">
                <span className="mobile-card-label">Equipment</span>
                <span className="mobile-card-value">{e.make} {e.model}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Type</span>
                <span className="mobile-card-value">
                  <Link to={`/equipment/${e.id}`} className="link">{e.equipment_type_name}</Link>
                </span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Serial / #</span>
                <span className="mobile-card-value">{e.equipment_number ? `#${e.equipment_number}` : e.serial_number}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Next Cal</span>
                <span className="mobile-card-value">{formatDate(e.next_calibration_due)}</span>
              </div>
              <div className="mobile-card-actions">
                <Link to={`/equipment/${e.id}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <p>{equipment.length === 0 ? 'No equipment yet. Add your first item.' : 'No matches for your search.'}</p>
          </div>
        )}
      </div>

      {showModal && (
        <EquipmentModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            load();
          }}
        />
      )}

      {showBulkModal && (
        <BulkEditModal
          equipmentIds={Array.from(selectedIds)}
          onClose={() => setShowBulkModal(false)}
          onSaved={handleBulkSaved}
        />
      )}
    </div>
  );
}
