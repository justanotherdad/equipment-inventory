import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';
import { api } from '../api';

interface EquipmentTestedRow {
  equipment_number_to_test: string;
  site_name: string | null;
  building: string | null;
  room_number: string | null;
  last_tested_at: string;
}

type SortKey = 'equipment_number_to_test' | 'site_name' | 'building' | 'room_number' | 'last_tested_at';

export default function EquipmentTested() {
  const [rows, setRows] = useState<EquipmentTestedRow[]>([]);
  const [filterEquip, setFilterEquip] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('last_tested_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [detailEquip, setDetailEquip] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<{
    equipment_number_to_test: string;
    tests: Array<{
      sign_out_id: number;
      signed_out_at: string;
      signed_in_at: string | null;
      site_name: string | null;
      building: string | null;
      room_number: string | null;
      equipment_used: Array<{ id: number; make: string; model: string; serial_number: string; equipment_number: string | null }>;
      usage_equipment: string[];
    }>;
  } | null>(null);

  const load = async () => {
    const data = await api.equipmentTested.getAll();
    setRows(data);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (detailEquip) {
      api.equipmentTested.getDetail(detailEquip).then(setDetailData).catch(() => setDetailData(null));
    } else {
      setDetailData(null);
    }
  }, [detailEquip]);

  const equipOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.equipment_number_to_test).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const siteOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.site_name).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const buildingOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.building).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const roomOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.room_number).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterEquip && r.equipment_number_to_test !== filterEquip) return false;
      if (filterSite && r.site_name !== filterSite) return false;
      if (filterBuilding && r.building !== filterBuilding) return false;
      if (filterRoom && r.room_number !== filterRoom) return false;
      return true;
    });
  }, [rows, filterEquip, filterSite, filterBuilding, filterRoom]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (sortKey === 'last_tested_at') {
        cmp = new Date(av as string).getTime() - new Date(bv as string).getTime();
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

  const hasFilters = filterEquip || filterSite || filterBuilding || filterRoom;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('default', { dateStyle: 'medium' });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Equipment Tested</h2>
          <p>Equipment numbers that have been tested, with locations</p>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
          <select
            value={filterEquip}
            onChange={(e) => setFilterEquip(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 140 }}
          >
            <option value="">All equipment #</option>
            {equipOptions.map((e) => (
              <option key={e} value={e}>#{e}</option>
            ))}
          </select>
          <select
            value={filterSite}
            onChange={(e) => setFilterSite(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 140 }}
          >
            <option value="">All sites</option>
            {siteOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterBuilding}
            onChange={(e) => setFilterBuilding(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 140 }}
          >
            <option value="">All buildings</option>
            {buildingOptions.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <select
            value={filterRoom}
            onChange={(e) => setFilterRoom(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-primary)', color: 'var(--text-primary)', minWidth: 140 }}
          >
            <option value="">All rooms</option>
            {roomOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          {hasFilters && (
            <button type="button" className="btn btn-secondary" onClick={() => { setFilterEquip(''); setFilterSite(''); setFilterBuilding(''); setFilterRoom(''); }}>
              Clear filters
            </button>
          )}
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('equipment_number_to_test')}>
                  Equipment # {sortKey === 'equipment_number_to_test' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="sortable" onClick={() => handleSort('site_name')}>
                  Site {sortKey === 'site_name' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="sortable" onClick={() => handleSort('building')}>
                  Building {sortKey === 'building' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="sortable" onClick={() => handleSort('room_number')}>
                  Room {sortKey === 'room_number' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="sortable" onClick={() => handleSort('last_tested_at')}>
                  Last tested {sortKey === 'last_tested_at' && (sortAsc ? '↑' : '↓')}
                </th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, idx) => (
                <tr key={`${r.equipment_number_to_test}-${r.site_name}-${r.building}-${r.room_number}-${idx}`}>
                  <td>
                    <button
                      type="button"
                      className="link"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit', textAlign: 'left' }}
                      onClick={() => setDetailEquip(r.equipment_number_to_test)}
                    >
                      #{r.equipment_number_to_test}
                    </button>
                  </td>
                  <td>{r.site_name ?? '—'}</td>
                  <td>{r.building ?? '—'}</td>
                  <td>{r.room_number ?? '—'}</td>
                  <td>{formatDate(r.last_tested_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '0.25rem 0.5rem' }}
                      onClick={() => setDetailEquip(r.equipment_number_to_test)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mobile-list">
          {sorted.map((r, idx) => (
            <div key={`${r.equipment_number_to_test}-${idx}`} className="mobile-card">
              <div className="mobile-card-row">
                <span className="mobile-card-label">Equipment #</span>
                <button
                  type="button"
                  className="link mobile-card-value"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                  onClick={() => setDetailEquip(r.equipment_number_to_test)}
                >
                  #{r.equipment_number_to_test}
                </button>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Site</span>
                <span className="mobile-card-value">{r.site_name ?? '—'}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Building</span>
                <span className="mobile-card-value">{r.building ?? '—'}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Room</span>
                <span className="mobile-card-value">{r.room_number ?? '—'}</span>
              </div>
              <div className="mobile-card-row">
                <span className="mobile-card-label">Last tested</span>
                <span className="mobile-card-value">{formatDate(r.last_tested_at)}</span>
              </div>
              <div className="mobile-card-actions">
                <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={() => setDetailEquip(r.equipment_number_to_test)}>
                  View details
                </button>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="empty-state">
            <p>{rows.length === 0 ? 'No equipment tested yet.' : 'No matches for your filters.'}</p>
          </div>
        )}
      </div>

      {detailEquip && detailData && (
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
          onClick={() => setDetailEquip(null)}
        >
          <div
            className="card"
            style={{ maxWidth: 560, maxHeight: '85vh', overflow: 'auto' }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Equipment #{detailData.equipment_number_to_test} – Test history</h3>
              <button type="button" className="btn btn-secondary" onClick={() => setDetailEquip(null)} style={{ padding: '0.35rem' }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Equipment used for testing, dates, and locations
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {detailData.tests.map((t) => (
                <div key={t.sign_out_id} style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ marginBottom: '0.75rem', fontWeight: 600 }}>{formatDate(t.signed_out_at)}</div>
                  <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <div><strong>Location:</strong> {[t.site_name, t.building, t.room_number].filter(Boolean).join(' • ') || '—'}</div>
                    <div>
                      <strong>Equipment used:</strong>
                      <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                        {t.equipment_used.map((eq, i) => (
                          <li key={i}>
                            {eq.id ? (
                              <Link to={`/equipment/${eq.id}`} className="link">{eq.make} {eq.model} {eq.equipment_number ? `#${eq.equipment_number}` : eq.serial_number}</Link>
                            ) : (
                              <>{eq.make} {eq.model} {eq.equipment_number ? `#${eq.equipment_number}` : eq.serial_number}</>
                            )}
                          </li>
                        ))}
                        {t.usage_equipment.map((u, i) => (
                          <li key={`u-${i}`}>{u}</li>
                        ))}
                      </ul>
                    </div>
                    {t.signed_in_at && (
                      <div style={{ color: 'var(--text-muted)' }}>Returned: {formatDate(t.signed_in_at)}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {detailData.tests.length === 0 && (
              <p style={{ color: 'var(--text-muted)' }}>No test records found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
