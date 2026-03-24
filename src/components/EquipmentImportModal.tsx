import { useState, useEffect, useMemo } from 'react';
import { Upload } from 'lucide-react';
import { api } from '../api';

interface EquipmentType {
  id: number;
  name: string;
}

interface Department {
  id: number;
  site_id: number;
  name: string;
  site_name?: string;
}

interface Props {
  onClose: () => void;
  onImported: () => void;
}

/** Parses CSV with quoted fields and commas inside quotes */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field.trim());
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim());
      field = '';
      if (row.some((x) => x.length > 0)) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  row.push(field.trim());
  if (row.some((x) => x.length > 0)) rows.push(row);
  return rows;
}

function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

const HEADER_MAP: Record<string, string> = {
  department: 'department',
  department_name: 'department',
  dept: 'department',
  equipment_type: 'equipment_type',
  equipment_type_name: 'equipment_type',
  type: 'equipment_type',
  equipmenttype: 'equipment_type',
  make: 'make',
  model: 'model',
  serial_number: 'serial_number',
  serial: 'serial_number',
  serialnumber: 'serial_number',
  equipment_number: 'equipment_number',
  equipmentnumber: 'equipment_number',
  equip_number: 'equipment_number',
  last_calibration_date: 'last_calibration_date',
  last_cal: 'last_calibration_date',
  last_calibration: 'last_calibration_date',
  next_calibration_due: 'next_calibration_due',
  next_cal_due: 'next_calibration_due',
  next_calibration: 'next_calibration_due',
  notes: 'notes',
};

function mapRow(headers: string[], cells: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((h, i) => {
    const key = HEADER_MAP[normalizeHeader(h)] ?? normalizeHeader(h);
    if (key && cells[i] !== undefined) out[key] = cells[i];
  });
  return out;
}

function departmentLabel(d: Department): string {
  return d.site_name ? `${d.name} (${d.site_name})` : d.name;
}

function parseDateCell(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mo = m[1].padStart(2, '0');
    const da = m[2].padStart(2, '0');
    return `${m[3]}-${mo}-${da}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export default function EquipmentImportModal({ onClose, onImported }: Props) {
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: number; errors: string[] } | null>(null);

  useEffect(() => {
    api.equipmentTypes.getAll().then((t) => setTypes(t as EquipmentType[]));
    api.departments.getAll().then((d) => setDepartments(d as Department[]));
  }, []);

  const deptByLabel = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of departments) {
      m.set(departmentLabel(d).toLowerCase(), d.id);
      m.set(d.name.trim().toLowerCase(), d.id);
    }
    return m;
  }, [departments]);

  const typeByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of types) {
      m.set(t.name.trim().toLowerCase(), t.id);
    }
    return m;
  }, [types]);

  const resolveDepartmentId = (raw: string): { id: number | null; error?: string } => {
    const s = raw.trim();
    if (!s) return { id: null };
    const id = deptByLabel.get(s.toLowerCase());
    if (id != null) return { id };
    const matches = departments.filter((d) => d.name.toLowerCase() === s.toLowerCase());
    if (matches.length === 1) return { id: matches[0].id };
    if (matches.length > 1) {
      return { id: null, error: `Multiple departments named "${s}". Use the full "Name (Site)" label from the app.` };
    }
    return { id: null, error: `Unknown department "${s}".` };
  };

  const resolveTypeId = (raw: string): number | null => {
    const s = raw.trim();
    if (!s) return null;
    return typeByName.get(s.toLowerCase()) ?? null;
  };

  const runImport = async (file: File) => {
    setBusy(true);
    setResult(null);
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      setResult({ ok: 0, errors: ['File must include a header row and at least one data row.'] });
      setBusy(false);
      return;
    }
    const headers = rows[0].map((h) => normalizeHeader(h));
    const required = ['department', 'equipment_type', 'make', 'model', 'serial_number'];
    const mappedKeys = new Set(headers.map((h) => HEADER_MAP[h] ?? h).filter(Boolean));
    const missing = required.filter((k) => !mappedKeys.has(k));
    if (missing.length) {
      setResult({
        ok: 0,
        errors: [
          `Missing required column(s): ${missing.join(', ')}. Use the exact header names from the instructions (or common aliases).`,
        ],
      });
      setBusy(false);
      return;
    }

    const errors: string[] = [];
    let ok = 0;
    let lineNum = 1;

    for (let r = 1; r < rows.length; r++) {
      lineNum++;
      const cells = rows[r];
      if (!cells.length || cells.every((c) => !c.trim())) continue;
      const row = mapRow(rows[0], cells);

      const deptRaw = row.department ?? '';
      const typeRaw = row.equipment_type ?? '';
      const make = (row.make ?? '').trim();
      const model = (row.model ?? '').trim();
      const serial = (row.serial_number ?? '').trim();
      const equipNum = (row.equipment_number ?? '').trim();
      const notes = (row.notes ?? '').trim();
      const lastCal = parseDateCell(row.last_calibration_date ?? '');
      const nextDue = parseDateCell(row.next_calibration_due ?? '');

      const deptRes = resolveDepartmentId(deptRaw);
      const department_id = deptRes.id;
      if (deptRes.error) {
        errors.push(`Line ${lineNum}: ${deptRes.error}`);
        continue;
      }
      const equipment_type_id = resolveTypeId(typeRaw);
      if (!equipment_type_id) {
        errors.push(`Line ${lineNum}: Unknown equipment type "${typeRaw}". Use the exact type name from Admin → Equipment Types.`);
        continue;
      }
      if (!make || !model || !serial) {
        errors.push(`Line ${lineNum}: make, model, and serial_number are required.`);
        continue;
      }

      try {
        await api.equipment.create({
          equipment_type_id,
          department_id,
          make,
          model,
          serial_number: serial,
          equipment_number: equipNum || null,
          last_calibration_date: lastCal,
          next_calibration_due: nextDue,
          notes: notes || null,
        });
        ok++;
      } catch (e) {
        errors.push(`Line ${lineNum}: ${e instanceof Error ? e.message : 'Failed'}`);
      }
    }

    setResult({ ok, errors });
    setBusy(false);
    if (ok > 0) onImported();
  };

  const sampleCsv = [
    'department,equipment_type,make,model,serial_number,equipment_number,last_calibration_date,next_calibration_due,notes',
    '"Example Dept (Example Site)","Temperature Logger","Acme","Model X","SN12345","A1","2025-01-15","2026-01-15","Imported row"',
  ].join('\n');

  const downloadSample = () => {
    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'equipment-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h3>Import equipment from CSV</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div style={{ padding: '0 1rem 1rem' }}>
          <div
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              marginBottom: '1rem',
              lineHeight: 1.5,
            }}
          >
            <p style={{ marginTop: 0, fontWeight: 600, color: 'var(--text-primary)' }}>File layout</p>
            <ul style={{ margin: '0.5rem 0', paddingLeft: '1.25rem' }}>
              <li>First row must be a <strong>header</strong> with column names (see below).</li>
              <li>One equipment item per row. UTF-8 encoding recommended.</li>
              <li>
                Fields with commas should be wrapped in double quotes (e.g. <code style={{ fontSize: '0.8rem' }}>&quot;Name, Inc&quot;</code>).
              </li>
            </ul>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Columns</p>
            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.35rem 0' }}>Column</th>
                  <th style={{ padding: '0.35rem 0' }}>Required</th>
                  <th style={{ padding: '0.35rem 0' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '0.25rem 0' }}>
                    <code>department</code>
                  </td>
                  <td>Yes*</td>
                  <td>
                    Must match the Department dropdown exactly (e.g. &quot;Dept Name (Site Name)&quot;). Leave blank only if your role allows equipment without a department.
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.25rem 0' }}>
                    <code>equipment_type</code>
                  </td>
                  <td>Yes</td>
                  <td>Exact name of the equipment type (same as in Add Equipment).</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.25rem 0' }}>
                    <code>make</code>, <code>model</code>, <code>serial_number</code>
                  </td>
                  <td>Yes</td>
                  <td>Text. Use N/A for serial if needed.</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.25rem 0' }}>
                    <code>equipment_number</code>
                  </td>
                  <td>No</td>
                  <td>Optional barcode / asset number (no # prefix).</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.25rem 0' }}>
                    <code>last_calibration_date</code>, <code>next_calibration_due</code>
                  </td>
                  <td>No</td>
                  <td>Dates as YYYY-MM-DD or MM/DD/YYYY. Leave blank if unknown.</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.25rem 0' }}>
                    <code>notes</code>
                  </td>
                  <td>No</td>
                  <td>Free text.</td>
                </tr>
              </tbody>
            </table>
            <p style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Calibration PDFs are not imported; add them on each equipment detail page after import.
            </p>
            <button type="button" className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={downloadSample}>
              Download sample CSV template
            </button>
          </div>

          <label className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: busy ? 'not-allowed' : 'pointer' }}>
            <Upload size={18} />
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void runImport(f);
              }}
            />
          </label>

          {busy && <p style={{ marginTop: '1rem' }}>Importing…</p>}

          {result && (
            <div style={{ marginTop: '1rem' }}>
              {result.ok > 0 && (
                <p style={{ color: '#22c55e' }}>
                  Successfully imported {result.ok} item{result.ok === 1 ? '' : 's'}.
                </p>
              )}
              {result.errors.length > 0 && (
                <div style={{ marginTop: '0.5rem' }}>
                  <p style={{ color: 'var(--danger)', marginBottom: '0.5rem' }}>Issues:</p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', maxHeight: 160, overflow: 'auto' }}>
                    {result.errors.map((err, i) => (
                      <li key={i} style={{ marginBottom: '0.25rem' }}>
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: '1.25rem', marginBottom: 0 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
