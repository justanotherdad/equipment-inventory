import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Edit3, ArrowUpDown, ChevronLeft, ChevronRight, X, Upload, Download } from 'lucide-react';
import EquipmentModal from '../components/EquipmentModal';
import EquipmentImportModal from '../components/EquipmentImportModal';
import BulkEditModal from '../components/BulkEditModal';
import BulkDeleteModal from '../components/BulkDeleteModal';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { buildCsvRow } from '../utils/csvExport';

type EquipmentStatus = 'available' | 'checked_out' | 'out_for_calibration';

interface Equipment {
  id: number;
  equipment_type_id?: number;
  department_id?: number | null;
  department_name?: string | null;
  site_name?: string | null;
  company_name?: string | null;
  equipment_type_name: string;
  make: string;
  model: string;
  serial_number: string;
  equipment_number: string | null;
  last_calibration_date: string | null;
  next_calibration_due: string | null;
  notes?: string | null;
}

interface SignOutRecord {
  id: number;
  equipment_id: number;
  signed_out_at: string;
  signed_in_at: string | null;
  purpose: string | null;
  date_from?: string | null;
  date_to?: string | null;
}

/** Matches "Dates: YYYY-MM-DD to YYYY-MM-DD" from sign-out purpose (same format as createSignOut). */
function parseReservationDatesFromPurpose(purpose: string | null | undefined): { from: string | null; to: string | null } {
  if (!purpose) return { from: null, to: null };
  const m = purpose.match(/Dates:\s*(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})/i);
  if (!m) return { from: null, to: null };
  return { from: m[1], to: m[2] };
}

/** Active sign-outs with no return date should cover all future calendar days until check-in (not "until now"). */
const FAR_FUTURE_END = new Date('9999-12-31T23:59:59.999Z');

type SortKey =
  | 'equipment_type_name'
  | 'department_name'
  | 'company_name'
  | 'make'
  | 'model'
  | 'serial_number'
  | 'equipment_number'
  | 'status'
  | 'last_calibration_date'
  | 'next_calibration_due';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'serial_number', label: 'Serial #' },
  { key: 'equipment_number', label: 'Equip #' },
  { key: 'equipment_type_name', label: 'Type' },
  { key: 'department_name', label: 'Department' },
  { key: 'company_name', label: 'Company' },
  { key: 'make', label: 'Make' },
  { key: 'model', label: 'Model' },
  { key: 'status', label: 'Status' },
  { key: 'last_calibration_date', label: 'Last Cal' },
  { key: 'next_calibration_due', label: 'Next Cal Due' },
];

const STATUS_LABELS: Record<EquipmentStatus, string> = {
  available: 'Available',
  checked_out: 'In-Use',
  out_for_calibration: 'Out-of-Service',
};

function getStatusForEquipment(equipmentId: number, activeSignOuts: SignOutRecord[]): EquipmentStatus {
  const so = activeSignOuts.find((s) => s.equipment_id === equipmentId);
  if (!so) return 'available';
  const purpose = (so.purpose ?? '').toLowerCase();
  if (purpose.includes('calibration')) return 'out_for_calibration';
  return 'checked_out';
}

/** Parse YYYY-MM-DD as local calendar date (avoids UTC off-by-one from `new Date('YYYY-MM-DD')`). */
function parseLocalDateYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
}

/** Format a YYYY-MM-DD key for display (never use `new Date(ymd)` alone — it parses as UTC). */
function formatYmdLocalLong(ymd: string): string {
  const [y, m, d] = ymd.split('-').map((x) => parseInt(x, 10));
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('default', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function heatMapEquipmentHoverTitle(e: Equipment): string {
  const name = [e.make, e.model].filter(Boolean).join(' ').trim();
  const parts = [name || 'Equipment', `S/N ${e.serial_number}`];
  if (e.equipment_number) parts.push(`Equip #${e.equipment_number}`);
  return parts.join(' · ');
}

function signOutCoversDay(signOut: SignOutRecord, dayStr: string): boolean {
  const parsed = parseReservationDatesFromPurpose(signOut.purpose);
  const df = signOut.date_from ?? parsed.from;
  const dt = signOut.date_to ?? parsed.to;
  if (df && dt) {
    return dayStr >= df && dayStr <= dt;
  }
  const dayStart = parseLocalDateYmd(dayStr);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = parseLocalDateYmd(dayStr);
  dayEnd.setHours(23, 59, 59, 999);
  const outAt = new Date(signOut.signed_out_at);
  const inAt = signOut.signed_in_at ? new Date(signOut.signed_in_at) : FAR_FUTURE_END;
  return outAt <= dayEnd && inAt >= dayStart;
}

export default function EquipmentList() {
  const { profile } = useAuth();
  const canEdit = profile?.role === 'equipment_manager' || profile?.role === 'company_admin' || profile?.role === 'super_admin';
  const isSuperAdmin = profile?.role === 'super_admin';
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [activeSignOuts, setActiveSignOuts] = useState<SignOutRecord[]>([]);
  const [signOutsInMonth, setSignOutsInMonth] = useState<SignOutRecord[]>([]);
  const [filter, setFilter] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterMake, setFilterMake] = useState<string>('');
  const [filterModel, setFilterModel] = useState<string>('');
  const [heatMapSearch, setHeatMapSearch] = useState('');
  const [heatMapFilterType, setHeatMapFilterType] = useState('');
  const [heatMapFilterMake, setHeatMapFilterMake] = useState('');
  const [heatMapFilterModel, setHeatMapFilterModel] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>('serial_number');
  const [sortAsc, setSortAsc] = useState(true);
  const [heatMapMonth, setHeatMapMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [dayDetail, setDayDetail] = useState<{ date: string; day: number } | null>(null);

  const load = async () => {
    const [equipData, activeData] = await Promise.all([
      api.equipment.getAll(),
      api.signOuts.getActive(),
    ]);
    setEquipment(equipData);
    setActiveSignOuts(activeData as SignOutRecord[]);
  };

  useEffect(() => {
    load();
  }, []);

  const loadSignOutsForMonth = async () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = heatMapMonth.year;
    const mo = heatMapMonth.month + 1;
    const startStr = `${y}-${pad(mo)}-01`;
    const lastDay = new Date(heatMapMonth.year, heatMapMonth.month + 1, 0).getDate();
    const endStr = `${y}-${pad(mo)}-${pad(lastDay)}`;
    const data = await api.signOuts.getInDateRange(startStr, endStr);
    setSignOutsInMonth(data as SignOutRecord[]);
  };

  useEffect(() => {
    loadSignOutsForMonth();
  }, [heatMapMonth.year, heatMapMonth.month]);

  const typeOptions = useMemo(() => {
    const set = new Set(equipment.map((e) => e.equipment_type_name).filter(Boolean));
    return Array.from(set).sort();
  }, [equipment]);

  const makeOptions = useMemo(() => {
    const set = new Set(equipment.map((e) => e.make).filter(Boolean));
    return Array.from(set).sort();
  }, [equipment]);

  const modelOptions = useMemo(() => {
    const set = new Set(equipment.map((e) => e.model).filter(Boolean));
    return Array.from(set).sort();
  }, [equipment]);

  const filtered = useMemo(() => {
    return equipment.filter((e) => {
      if (filter) {
        const q = filter.toLowerCase();
        if (
          !e.make.toLowerCase().includes(q) &&
          !e.model.toLowerCase().includes(q) &&
          !e.serial_number.toLowerCase().includes(q) &&
          !(e.equipment_number?.toLowerCase().includes(q) ?? false) &&
          !e.equipment_type_name?.toLowerCase().includes(q) &&
          !(e.department_name?.toLowerCase().includes(q) ?? false) &&
          !(e.company_name?.toLowerCase().includes(q) ?? false)
        ) {
          return false;
        }
      }
      if (filterType && e.equipment_type_name !== filterType) return false;
      if (filterMake && e.make !== filterMake) return false;
      if (filterModel && e.model !== filterModel) return false;
      return true;
    });
  }, [equipment, filter, filterType, filterMake, filterModel]);

  const filteredForHeatMap = useMemo(() => {
    return equipment.filter((e) => {
      if (heatMapSearch) {
        const q = heatMapSearch.toLowerCase();
        if (
          !e.make.toLowerCase().includes(q) &&
          !e.model.toLowerCase().includes(q) &&
          !e.serial_number.toLowerCase().includes(q) &&
          !(e.equipment_number?.toLowerCase().includes(q) ?? false) &&
          !e.equipment_type_name?.toLowerCase().includes(q) &&
          !(e.department_name?.toLowerCase().includes(q) ?? false) &&
          !(e.company_name?.toLowerCase().includes(q) ?? false)
        ) {
          return false;
        }
      }
      if (heatMapFilterType && e.equipment_type_name !== heatMapFilterType) return false;
      if (heatMapFilterMake && e.make !== heatMapFilterMake) return false;
      if (heatMapFilterModel && e.model !== heatMapFilterModel) return false;
      return true;
    });
  }, [equipment, heatMapSearch, heatMapFilterType, heatMapFilterMake, heatMapFilterModel]);

  const equipmentWithStatus = useMemo(() => {
    return filtered.map((e) => ({
      ...e,
      status: getStatusForEquipment(e.id, activeSignOuts),
    }));
  }, [filtered, activeSignOuts]);

  const equipmentWithStatusForHeatMap = useMemo(() => {
    return filteredForHeatMap.map((e) => ({
      ...e,
      status: getStatusForEquipment(e.id, activeSignOuts),
    }));
  }, [filteredForHeatMap, activeSignOuts]);

  const formatDate = (d: string | null) => (d ? new Date(d).toLocaleDateString() : '—');

  const sorted = useMemo(() => {
    const arr = [...equipmentWithStatus];
    arr.sort((a, b) => {
      let cmp = 0;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (sortKey === 'last_calibration_date' || sortKey === 'next_calibration_due') {
        const da = av ? new Date(av as string).getTime() : 0;
        const db = bv ? new Date(bv as string).getTime() : 0;
        cmp = da - db;
      } else if (sortKey === 'status') {
        const order = { available: 0, checked_out: 1, out_for_calibration: 2 };
        cmp = order[a.status] - order[b.status];
      } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''));
      }
      return sortAsc ? cmp : -cmp;
    });
    return arr;
  }, [equipmentWithStatus, sortKey, sortAsc]);

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

  const handleBulkDeleted = () => {
    setShowBulkDeleteModal(false);
    setSelectedIds(new Set());
    load();
  };

  const handleExportCsv = () => {
    const header = buildCsvRow([
      'department',
      'department_id',
      'equipment_type',
      'equipment_type_id',
      'make',
      'model',
      'serial_number',
      'equipment_number',
      'last_calibration_date',
      'next_calibration_due',
      'notes',
      'company_name',
    ]);
    const rows = sorted.map((e) =>
      buildCsvRow([
        e.department_name ?? '',
        e.department_id ?? '',
        e.equipment_type_name ?? '',
        e.equipment_type_id ?? '',
        e.make,
        e.model,
        e.serial_number,
        e.equipment_number ?? '',
        e.last_calibration_date ? e.last_calibration_date.slice(0, 10) : '',
        e.next_calibration_due ? e.next_calibration_due.slice(0, 10) : '',
        e.notes ?? '',
        e.company_name ?? '',
      ])
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `equipment-export-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const daysInMonth = useMemo(() => {
    const d = new Date(heatMapMonth.year, heatMapMonth.month, 1);
    const days: number[] = [];
    const count = new Date(heatMapMonth.year, heatMapMonth.month + 1, 0).getDate();
    for (let i = 1; i <= count; i++) days.push(i);
    const firstDow = d.getDay();
    return { days, firstDow, monthName: d.toLocaleString('default', { month: 'long', year: 'numeric' }) };
  }, [heatMapMonth]);

  const getStatusForEquipmentOnDay = (equipmentId: number, day: number): EquipmentStatus | null => {
    const dateStr = `${heatMapMonth.year}-${String(heatMapMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const so = signOutsInMonth.find((s) => s.equipment_id === equipmentId && signOutCoversDay(s, dateStr));
    if (!so) return 'available';
    const purpose = (so.purpose ?? '').toLowerCase();
    if (purpose.includes('calibration')) return 'out_for_calibration';
    return 'checked_out';
  };

  const getEquipmentForDay = (day: number) => {
    return equipmentWithStatusForHeatMap.map((e) => ({
      ...e,
      dayStatus: getStatusForEquipmentOnDay(e.id, day) as EquipmentStatus,
    }));
  };

  const prevMonth = () => {
    setHeatMapMonth((m) => (m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 }));
  };

  const nextMonth = () => {
    setHeatMapMonth((m) => (m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 }));
  };

  const hasActiveTableFilters = filter || filterType || filterMake || filterModel;
  const hasActiveHeatMapFilters = heatMapSearch || heatMapFilterType || heatMapFilterMake || heatMapFilterModel;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Equipment</h2>
          <p>Manage your equipment inventory</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {canEdit && selectedIds.size > 0 && (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowBulkModal(true)}>
                <Edit3 size={18} />
                Edit {selectedIds.size} selected
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setShowBulkDeleteModal(true)}>
                Delete {selectedIds.size} selected
              </button>
            </>
          )}
          {canEdit && (
            <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
              <Upload size={18} />
              Import
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={handleExportCsv} disabled={sorted.length === 0}>
            <Download size={18} />
            Export
          </button>
          {canEdit && (
            <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={18} />
              Add Equipment
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '1rem', marginBottom: '1rem', alignItems: 'center', overflowX: 'auto', minWidth: 0 }}>
          <div className="form-group" style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{ paddingLeft: '2.5rem', width: '100%' }}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: '0.5rem', alignItems: 'center', flexShrink: 0 }}>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 120 }}
            >
              <option value="">All types</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={filterMake}
              onChange={(e) => setFilterMake(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 120 }}
            >
              <option value="">All makes</option>
              {makeOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <select
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 120 }}
            >
              <option value="">All models</option>
              {modelOptions.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            {hasActiveTableFilters && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setFilter('');
                  setFilterType('');
                  setFilterMake('');
                  setFilterModel('');
                }}
              >
                Clear filters
              </button>
            )}
          </div>
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
                <th className="sortable" onClick={() => handleSort('department_name')}>Department {sortKey === 'department_name' && (sortAsc ? '↑' : '↓')}</th>
                {isSuperAdmin && (
                  <th className="sortable" onClick={() => handleSort('company_name')}>Company {sortKey === 'company_name' && (sortAsc ? '↑' : '↓')}</th>
                )}
                <th className="sortable" onClick={() => handleSort('make')}>Make {sortKey === 'make' && (sortAsc ? '↑' : '↓')}</th>
                <th className="sortable" onClick={() => handleSort('model')}>Model {sortKey === 'model' && (sortAsc ? '↑' : '↓')}</th>
                <th className="sortable" onClick={() => handleSort('serial_number')}>Serial # {sortKey === 'serial_number' && (sortAsc ? '↑' : '↓')}</th>
                <th className="sortable" onClick={() => handleSort('equipment_number')}>Equip # {sortKey === 'equipment_number' && (sortAsc ? '↑' : '↓')}</th>
                <th className="sortable" onClick={() => handleSort('status')}>Status {sortKey === 'status' && (sortAsc ? '↑' : '↓')}</th>
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
                  <td>{e.department_name ?? '—'}</td>
                  {isSuperAdmin && <td>{e.company_name ?? '—'}</td>}
                  <td>{e.make}</td>
                  <td>{e.model}</td>
                  <td>{e.serial_number}</td>
                  <td>{e.equipment_number ? `#${e.equipment_number}` : '—'}</td>
                  <td>
                    <span className={`status-badge status-${e.status}`} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: 4 }}>
                      {STATUS_LABELS[e.status]}
                    </span>
                  </td>
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
                <span className="mobile-card-label">Department</span>
                <span className="mobile-card-value">{e.department_name ?? '—'}</span>
              </div>
              {isSuperAdmin && (
                <div className="mobile-card-row">
                  <span className="mobile-card-label">Company</span>
                  <span className="mobile-card-value">{e.company_name ?? '—'}</span>
                </div>
              )}
              <div className="mobile-card-row">
                <span className="mobile-card-label">Status</span>
                <span className="mobile-card-value">
                  <span className={`status-badge status-${e.status}`}>{STATUS_LABELS[e.status]}</span>
                </span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Serial #</span>
                <span className="mobile-card-value">{e.serial_number}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Equip #</span>
                <span className="mobile-card-value">{e.equipment_number ? `#${e.equipment_number}` : '—'}</span>
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
            <p>{equipment.length === 0 ? 'No equipment yet. Add your first item.' : 'No matches for your search or filters.'}</p>
          </div>
        )}
      </div>

      {/* Heat map */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Availability Heat Map</h3>
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Choose which equipment rows appear in the grid below. These filters are independent of the equipment table above.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
          <div className="form-group" style={{ position: 'relative', flex: '1 1 200px', minWidth: 0, marginBottom: 0 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search…"
              value={heatMapSearch}
              onChange={(e) => setHeatMapSearch(e.target.value)}
              style={{ paddingLeft: '2.25rem', width: '100%', paddingTop: '0.45rem', paddingBottom: '0.45rem' }}
              aria-label="Heat map search"
            />
          </div>
          <select
            value={heatMapFilterType}
            onChange={(e) => setHeatMapFilterType(e.target.value)}
            style={{ padding: '0.45rem 0.65rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 110 }}
            aria-label="Heat map type"
          >
            <option value="">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={heatMapFilterMake}
            onChange={(e) => setHeatMapFilterMake(e.target.value)}
            style={{ padding: '0.45rem 0.65rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 110 }}
            aria-label="Heat map make"
          >
            <option value="">All makes</option>
            {makeOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select
            value={heatMapFilterModel}
            onChange={(e) => setHeatMapFilterModel(e.target.value)}
            style={{ padding: '0.45rem 0.65rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 110 }}
            aria-label="Heat map model"
          >
            <option value="">All models</option>
            {modelOptions.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {hasActiveHeatMapFilters && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.65rem' }}
              onClick={() => {
                setHeatMapSearch('');
                setHeatMapFilterType('');
                setHeatMapFilterMake('');
                setHeatMapFilterModel('');
              }}
            >
              Clear heat map filters
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={prevMonth} style={{ padding: '0.35rem 0.5rem' }}>
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontWeight: 600, minWidth: 140, textAlign: 'center' }}>{daysInMonth.monthName}</span>
            <button type="button" className="btn btn-secondary" onClick={nextMonth} style={{ padding: '0.35rem 0.5rem' }}>
              <ChevronRight size={18} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: 'var(--equipment-status-available)', marginRight: 4 }} /> Available</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: 'var(--equipment-status-in-use)', marginRight: 4 }} /> In-Use</span>
            <span><span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: 'var(--equipment-status-out-of-service)', marginRight: 4 }} /> Out-of-Service</span>
          </div>
        </div>
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <div style={{ width: '100%', minWidth: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: `minmax(100px, 140px) repeat(${daysInMonth.days.length}, minmax(0, 1fr))`, gap: 2, fontSize: '0.7rem', width: '100%' }}>
              <div style={{ padding: '4px 6px', fontWeight: 600 }}>Equipment</div>
              {daysInMonth.days.map((d) => (
                <div key={d} style={{ padding: '4px 2px', fontWeight: 600, textAlign: 'center' }}>{d}</div>
              ))}
              {equipmentWithStatusForHeatMap.slice(0, 20).map((e) => (
                <div key={e.id} style={{ display: 'contents' }}>
                  <Link
                    to={`/equipment/${e.id}`}
                    className="link"
                    title={heatMapEquipmentHoverTitle(e)}
                    style={{ padding: '4px 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.7rem' }}
                  >
                    {e.make} {e.model}
                  </Link>
                  {daysInMonth.days.map((day) => {
                    const status = getStatusForEquipmentOnDay(e.id, day);
                    const color =
                      status === 'available'
                        ? 'var(--equipment-status-available)'
                        : status === 'checked_out'
                          ? 'var(--equipment-status-in-use)'
                          : 'var(--equipment-status-out-of-service)';
                    const dateStr = `${heatMapMonth.year}-${String(heatMapMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    return (
                      <div
                        key={`${e.id}-${day}`}
                        onClick={() => setDayDetail({ date: dateStr, day })}
                        title={`${day} - ${status?.replace('_', ' ') ?? 'available'}`}
                        style={{
                          minWidth: 20,
                          height: 24,
                          background: color,
                          borderRadius: 4,
                          cursor: 'pointer',
                          opacity: 0.9,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        {equipmentWithStatusForHeatMap.length > 20 && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing first 20 of {equipmentWithStatusForHeatMap.length} equipment rows matching the heat map filters.
          </p>
        )}
        {equipment.length > 0 && equipmentWithStatusForHeatMap.length === 0 && (
          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--warning)' }}>
            No equipment matches the heat map filters. Clear or adjust them to see the grid.
          </p>
        )}
      </div>

      {dayDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          onClick={() => setDayDetail(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 480, maxHeight: '80vh', overflow: 'auto' }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>
                Equipment on {formatYmdLocalLong(dayDetail.date)}
              </h3>
              <button type="button" className="btn btn-secondary" onClick={() => setDayDetail(null)} style={{ padding: '0.35rem' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {getEquipmentForDay(dayDetail.day).map((eq) => (
                <Link
                  key={eq.id}
                  to={`/equipment/${eq.id}`}
                  className="link"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: 8,
                    textDecoration: 'none',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
                    <span>{eq.make} {eq.model}</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      S/N {eq.serial_number}
                      {eq.equipment_number ? ` · Equip #${eq.equipment_number}` : ''}
                    </span>
                  </span>
                  <span className={`status-badge status-${eq.dayStatus}`} style={{ fontSize: '0.75rem' }}>
                    {STATUS_LABELS[eq.dayStatus]}
                  </span>
                </Link>
              ))}
            </div>
            {getEquipmentForDay(dayDetail.day).length === 0 && (
              <p style={{ color: 'var(--text-muted)' }}>No equipment activity recorded for this day.</p>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <EquipmentModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            load();
          }}
        />
      )}

      {showImportModal && (
        <EquipmentImportModal
          onClose={() => setShowImportModal(false)}
          onImported={() => {
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

      {showBulkDeleteModal && (
        <BulkDeleteModal
          equipmentIds={Array.from(selectedIds)}
          onClose={() => setShowBulkDeleteModal(false)}
          onDeleted={handleBulkDeleted}
        />
      )}
    </div>
  );
}
