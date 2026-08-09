import { useEffect, useState, useMemo } from 'react';
import { Plus, Edit, Trash2, ArrowUpDown } from 'lucide-react';
import EquipmentTypeModal from '../components/EquipmentTypeModal';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useCompanyScope } from '../contexts/CompanyScopeContext';

interface EquipmentType {
  id: number;
  name: string;
  requires_calibration: number;
  calibration_frequency_months: number | null;
  company_name?: string | null;
}

type SortKey = 'name' | 'requires_calibration' | 'calibration_frequency_months' | 'company_name';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'requires_calibration', label: 'Calibration' },
  { key: 'calibration_frequency_months', label: 'Frequency' },
];

export default function EquipmentTypes() {
  const { profile } = useAuth();
  const { companyId } = useCompanyScope();
  const isSuperAdmin = profile?.role === 'super_admin';
  const showCompanyCol = isSuperAdmin && companyId == null;
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);

  const load = async () => {
    const data = await api.equipmentTypes.getAll();
    setTypes(data as EquipmentType[]);
  };

  useEffect(() => {
    load();
  }, []);

  const sorted = useMemo(() => {
    const arr = [...types];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = (a.name || '').localeCompare(b.name || '');
      else if (sortKey === 'company_name') cmp = (a.company_name || '').localeCompare(b.company_name || '');
      else if (sortKey === 'requires_calibration') cmp = (a.requires_calibration ? 1 : 0) - (b.requires_calibration ? 1 : 0);
      else if (sortKey === 'calibration_frequency_months') {
        const va = a.calibration_frequency_months ?? -1;
        const vb = b.calibration_frequency_months ?? -1;
        cmp = va - vb;
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [types, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    setSortKey(key);
    setSortAsc((prev) => (sortKey === key ? !prev : true));
  };

  const cycleSortField = () => {
    const opts = showCompanyCol
      ? [...SORT_OPTIONS, { key: 'company_name' as SortKey, label: 'Company' }]
      : SORT_OPTIONS;
    const idx = opts.findIndex((o) => o.key === sortKey);
    setSortKey(opts[(idx + 1) % opts.length].key);
    setSortAsc(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this equipment type? Equipment of this type must be deleted or reassigned first.')) return;
    try {
      await api.equipmentTypes.delete(id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Equipment Types</h2>
          <p>Configure categories for this company (not shared across companies)</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setShowModal(true); }}>
          <Plus size={18} />
          Add Type
        </button>
      </div>

      <div className="card">
        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Equipment types define categories (e.g. Temperature Logger, Laptop) for one company only.
          For each type, you can specify whether calibration is required and the recalibration frequency in months.
        </p>
        <div className="sort-by-mobile">
          <button type="button" className="btn btn-secondary" onClick={cycleSortField}>
            <ArrowUpDown size={16} /> Sort by {(showCompanyCol
              ? [...SORT_OPTIONS, { key: 'company_name' as SortKey, label: 'Company' }]
              : SORT_OPTIONS
            ).find((o) => o.key === sortKey)?.label}
          </button>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('name')}>Name {sortKey === 'name' && (sortAsc ? '↑' : '↓')}</th>
                {showCompanyCol && (
                  <th className="sortable" onClick={() => handleSort('company_name')}>Company {sortKey === 'company_name' && (sortAsc ? '↑' : '↓')}</th>
                )}
                <th className="sortable" onClick={() => handleSort('requires_calibration')}>Requires Calibration {sortKey === 'requires_calibration' && (sortAsc ? '↑' : '↓')}</th>
                <th className="sortable" onClick={() => handleSort('calibration_frequency_months')}>Frequency {sortKey === 'calibration_frequency_months' && (sortAsc ? '↑' : '↓')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id}>
                  <td>
                    <button
                      type="button"
                      className="link"
                      onClick={() => { setEditingId(t.id); setShowModal(true); }}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', color: 'var(--accent)', fontSize: 'inherit' }}
                    >
                      {t.name}
                    </button>
                  </td>
                  {showCompanyCol && <td>{t.company_name ?? '—'}</td>}
                  <td>{t.requires_calibration ? 'Yes' : 'No'}</td>
                  <td>{t.calibration_frequency_months ? `Every ${t.calibration_frequency_months} months` : '—'}</td>
                  <td>
                    <button className="btn btn-secondary" style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem' }} onClick={() => { setEditingId(t.id); setShowModal(true); }}>
                      <Edit size={14} />
                    </button>
                    <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem' }} onClick={() => handleDelete(t.id)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mobile-list">
          {sorted.map((t) => (
            <div key={t.id} className="mobile-card">
              <div className="mobile-card-row">
                <span className="mobile-card-label">Name</span>
                <span className="mobile-card-value">
                  <button
                    type="button"
                    className="link"
                    onClick={() => { setEditingId(t.id); setShowModal(true); }}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', color: 'var(--accent)', fontSize: 'inherit' }}
                  >
                    {t.name}
                  </button>
                </span>
              </div>
              {showCompanyCol && (
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Company</span>
                  <span className="mobile-card-value">{t.company_name ?? '—'}</span>
                </div>
              )}
              <div className="mobile-card-row">
                <span className="mobile-card-label">Calibration</span>
                <span className="mobile-card-value">{t.requires_calibration ? 'Yes' : 'No'}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Frequency</span>
                <span className="mobile-card-value">{t.calibration_frequency_months ? `Every ${t.calibration_frequency_months} mo` : '—'}</span>
              </div>
              <div className="mobile-card-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setEditingId(t.id); setShowModal(true); }}>
                  <Edit size={14} /> Edit
                </button>
                <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => handleDelete(t.id)}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {types.length === 0 && (
          <div className="empty-state">
            <p>No equipment types for this company. Add one to get started.</p>
          </div>
        )}
      </div>

      {showModal && (
        <EquipmentTypeModal
          typeId={editingId}
          onClose={() => { setShowModal(false); setEditingId(null); }}
          onSaved={() => {
            setShowModal(false);
            setEditingId(null);
            load();
          }}
        />
      )}
    </div>
  );
}
