import { useEffect, useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, X, Download, FileText } from 'lucide-react';
import { api } from '../api';
import { buildCsvRow } from '../utils/csvExport';

interface EquipmentTestedRow {
  equipment_number_to_test: string;
  site_name: string | null;
  building: string | null;
  room_number: string | null;
  last_tested_at: string;
}

interface TestDetail {
  sign_out_id: number;
  signed_out_at: string;
  signed_in_at: string | null;
  site_name: string | null;
  building: string | null;
  room_number: string | null;
  equipment_used: Array<{
    id: number;
    make: string;
    model: string;
    serial_number: string;
    equipment_number: string | null;
    equipment_type_name?: string | null;
  }>;
  usage_equipment: string[];
}

type SortKey = 'equipment_number_to_test' | 'site_name' | 'building' | 'room_number' | 'last_tested_at';

function formatDateMed(d: string) {
  return new Date(d).toLocaleDateString('default', { dateStyle: 'medium' });
}

/** Build flat CSV rows for a set of rows (one row per test entry in detail). */
async function buildDetailRows(rows: EquipmentTestedRow[]) {
  const results: Array<{
    row: EquipmentTestedRow;
    detail: { equipment_number_to_test: string; tests: TestDetail[] };
  }> = [];
  for (const row of rows) {
    const detail = await api.equipmentTested.getDetail(row.equipment_number_to_test);
    results.push({ row, detail });
  }
  return results;
}

/** Export to CSV — multi-row with all test entries expanded. */
async function exportCsv(rows: EquipmentTestedRow[], filename: string) {
  const header = buildCsvRow([
    'Equipment # Tested',
    'Date Used',
    'Returned',
    'Site',
    'Building',
    'Room',
    'Test Equipment Make',
    'Test Equipment Model',
    'Test Equipment Type',
    'Test Equipment Serial #',
    'Test Equipment #',
  ]);
  const csvRows: string[] = [header];

  const details = await buildDetailRows(rows);
  for (const { detail } of details) {
    for (const test of detail.tests) {
      if (test.equipment_used.length === 0 && test.usage_equipment.length === 0) {
        csvRows.push(buildCsvRow([
          detail.equipment_number_to_test,
          formatDateMed(test.signed_out_at),
          test.signed_in_at ? formatDateMed(test.signed_in_at) : '',
          test.site_name ?? '',
          test.building ?? '',
          test.room_number ?? '',
          '', '', '', '', '',
        ]));
      } else {
        for (const eq of test.equipment_used) {
          csvRows.push(buildCsvRow([
            detail.equipment_number_to_test,
            formatDateMed(test.signed_out_at),
            test.signed_in_at ? formatDateMed(test.signed_in_at) : '',
            test.site_name ?? '',
            test.building ?? '',
            test.room_number ?? '',
            eq.make,
            eq.model,
            eq.equipment_type_name ?? '',
            eq.serial_number,
            eq.equipment_number ?? '',
          ]));
        }
        for (const u of test.usage_equipment) {
          csvRows.push(buildCsvRow([
            detail.equipment_number_to_test,
            formatDateMed(test.signed_out_at),
            test.signed_in_at ? formatDateMed(test.signed_in_at) : '',
            test.site_name ?? '',
            test.building ?? '',
            test.room_number ?? '',
            u, '', '', '', '',
          ]));
        }
      }
    }
  }

  const csv = csvRows.join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Export to PDF (opens HTML doc in new tab — user can print to PDF). */
async function exportPdf(rows: EquipmentTestedRow[], title: string) {
  const details = await buildDetailRows(rows);

  const sections = details.map(({ detail }) => {
    const testBlocks = detail.tests.map((test) => {
      const equipRows = [
        ...test.equipment_used.map((eq) =>
          `<tr>
            <td>${eq.make} ${eq.model}</td>
            <td>${eq.equipment_type_name ?? '—'}</td>
            <td>${eq.serial_number}</td>
            <td>${eq.equipment_number ? `#${eq.equipment_number}` : '—'}</td>
          </tr>`
        ),
        ...test.usage_equipment.map((u) =>
          `<tr><td colspan="4">${u}</td></tr>`
        ),
      ].join('');

      return `
        <div class="test-block">
          <div class="test-header">
            <strong>Date Used:</strong> ${formatDateMed(test.signed_out_at)}
            ${test.signed_in_at ? `&nbsp;&nbsp;<strong>Returned:</strong> ${formatDateMed(test.signed_in_at)}` : ''}
            &nbsp;&nbsp;<strong>Location:</strong> ${[test.site_name, test.building, test.room_number].filter(Boolean).join(' · ') || '—'}
          </div>
          ${equipRows ? `
          <table>
            <thead><tr><th>Equipment</th><th>Type</th><th>Serial #</th><th>Equip #</th></tr></thead>
            <tbody>${equipRows}</tbody>
          </table>` : '<p style="color:#666;font-style:italic">No test equipment recorded.</p>'}
        </div>`;
    }).join('');

    return `
      <div class="equip-section">
        <h2>Equipment #${detail.equipment_number_to_test}</h2>
        ${testBlocks || '<p>No test records.</p>'}
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #222; margin: 2cm; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .subtitle { color: #666; font-size: 11px; margin-bottom: 24px; }
  .equip-section { margin-bottom: 32px; border-top: 2px solid #333; padding-top: 12px; }
  h2 { font-size: 14px; margin: 0 0 12px 0; }
  .test-block { margin-bottom: 16px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
  .test-header { margin-bottom: 8px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #f0f0f0; text-align: left; padding: 4px 8px; border: 1px solid #ccc; }
  td { padding: 4px 8px; border: 1px solid #ddd; }
  @media print { body { margin: 1cm; } }
</style>
</head><body>
<h1>${title}</h1>
<div class="subtitle">Generated ${new Date().toLocaleString()}</div>
${sections}
</body></html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export default function EquipmentTested() {
  const [rows, setRows] = useState<EquipmentTestedRow[]>([]);
  const [selectedEquip, setSelectedEquip] = useState<Set<string>>(new Set());
  const [filterEquip, setFilterEquip] = useState('');
  const [filterSite, setFilterSite] = useState('');
  const [filterBuilding, setFilterBuilding] = useState('');
  const [filterRoom, setFilterRoom] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('last_tested_at');
  const [sortAsc, setSortAsc] = useState(false);
  const [detailEquip, setDetailEquip] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [detailData, setDetailData] = useState<{
    equipment_number_to_test: string;
    tests: TestDetail[];
  } | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

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

  const toggleSelect = (key: string) => {
    setSelectedEquip((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allSelected = sorted.length > 0 && sorted.every((r) => selectedEquip.has(r.equipment_number_to_test));
  const someSelected = selectedEquip.size > 0 && !allSelected;

  useEffect(() => {
    const el = selectAllRef.current;
    if (el) el.indeterminate = someSelected;
  }, [someSelected, allSelected]);

  const getSelectedRows = () => sorted.filter((r) => selectedEquip.has(r.equipment_number_to_test));

  const handleExport = async (format: 'csv' | 'pdf', rows: EquipmentTestedRow[], label: string) => {
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === 'csv') {
        await exportCsv(rows, `equipment-tested-${stamp}.csv`);
      } else {
        await exportPdf(rows, label);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Equipment Tested</h2>
          <p>Equipment numbers that have been tested, with locations</p>
        </div>
        {selectedEquip.size > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={exporting}
              onClick={() => handleExport('csv', getSelectedRows(), 'Equipment Tested Export')}
            >
              <Download size={16} /> Export {selectedEquip.size} selected (CSV)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={exporting}
              onClick={() => handleExport('pdf', getSelectedRows(), 'Equipment Tested Report')}
            >
              <FileText size={16} /> Export {selectedEquip.size} selected (PDF)
            </button>
          </div>
        )}
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
                <th style={{ width: 40 }}>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={() => {
                      if (allSelected) setSelectedEquip(new Set());
                      else setSelectedEquip(new Set(sorted.map((r) => r.equipment_number_to_test)));
                    }}
                    title="Select all"
                    aria-label="Select all rows"
                  />
                </th>
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
                <th style={{ width: 100 }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, idx) => (
                <tr key={`${r.equipment_number_to_test}-${r.site_name}-${r.building}-${r.room_number}-${idx}`}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedEquip.has(r.equipment_number_to_test)}
                      onChange={() => toggleSelect(r.equipment_number_to_test)}
                      aria-label={`Select #${r.equipment_number_to_test}`}
                    />
                  </td>
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
                  <td>{formatDateMed(r.last_tested_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.4rem' }}
                        title="Export CSV"
                        disabled={exporting}
                        onClick={() => handleExport('csv', [r], `equipment-tested-${r.equipment_number_to_test}`)}
                      >
                        <Download size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.4rem' }}
                        title="Export PDF"
                        disabled={exporting}
                        onClick={() => handleExport('pdf', [r], `Equipment #${r.equipment_number_to_test} – Test Report`)}
                      >
                        <FileText size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '0.25rem 0.5rem' }}
                        onClick={() => setDetailEquip(r.equipment_number_to_test)}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mobile-list">
          {sorted.map((r, idx) => (
            <div key={`${r.equipment_number_to_test}-${idx}`} className="mobile-card">
              <div className="mobile-card-row" style={{ alignItems: 'center' }}>
                <span className="mobile-card-label">Select</span>
                <span className="mobile-card-value" style={{ textAlign: 'right' }}>
                  <input
                    type="checkbox"
                    checked={selectedEquip.has(r.equipment_number_to_test)}
                    onChange={() => toggleSelect(r.equipment_number_to_test)}
                  />
                </span>
              </div>
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
                <span className="mobile-card-value">{formatDateMed(r.last_tested_at)}</span>
              </div>
              <div className="mobile-card-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  disabled={exporting}
                  onClick={() => handleExport('csv', [r], `equipment-tested-${r.equipment_number_to_test}`)}
                >
                  <Download size={14} /> CSV
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                  disabled={exporting}
                  onClick={() => handleExport('pdf', [r], `Equipment #${r.equipment_number_to_test} – Test Report`)}
                >
                  <FileText size={14} /> PDF
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => setDetailEquip(r.equipment_number_to_test)}
                >
                  Details
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0 }}>Equipment #{detailData.equipment_number_to_test} – Test history</h3>
              <button type="button" className="btn btn-secondary" onClick={() => setDetailEquip(null)} style={{ padding: '0.35rem' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                disabled={exporting}
                onClick={() => {
                  const row = rows.find((r) => r.equipment_number_to_test === detailEquip);
                  if (row) handleExport('csv', [row], `equipment-tested-${detailEquip}`);
                }}
              >
                <Download size={13} /> Export CSV
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                disabled={exporting}
                onClick={() => {
                  const row = rows.find((r) => r.equipment_number_to_test === detailEquip);
                  if (row) handleExport('pdf', [row], `Equipment #${detailEquip} – Test Report`);
                }}
              >
                <FileText size={13} /> Export PDF
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Equipment used for testing, dates, and locations
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {detailData.tests.map((t) => (
                <div key={t.sign_out_id} style={{ padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ marginBottom: '0.75rem', fontWeight: 600 }}>{formatDateMed(t.signed_out_at)}</div>
                  <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <div><strong>Location:</strong> {[t.site_name, t.building, t.room_number].filter(Boolean).join(' • ') || '—'}</div>
                    <div>
                      <strong>Equipment used:</strong>
                      <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0 }}>
                        {t.equipment_used.map((eq, i) => (
                          <li key={i}>
                            {eq.id ? (
                              <Link to={`/equipment/${eq.id}`} className="link">
                                {eq.make} {eq.model}{eq.equipment_type_name ? ` (${eq.equipment_type_name})` : ''} — S/N {eq.serial_number}{eq.equipment_number ? ` #${eq.equipment_number}` : ''}
                              </Link>
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
                      <div style={{ color: 'var(--text-muted)' }}>Returned: {formatDateMed(t.signed_in_at)}</div>
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
