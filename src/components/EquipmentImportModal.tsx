import { useEffect, useState } from 'react';
import { format, addMonths } from 'date-fns';
import { Upload } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { parseCsv } from '../utils/parseCsv';

interface EquipmentType {
  id: number;
  name: string;
  requires_calibration: number;
  calibration_frequency_months: number | null;
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

function normalizeKey(k: string): string {
  return k.trim().toLowerCase().replace(/\s+/g, '_');
}

function getCell(row: Record<string, string>, ...aliases: string[]): string {
  const normRow: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    normRow[normalizeKey(k)] = v;
  }
  for (const a of aliases) {
    const v = normRow[normalizeKey(a)];
    if (v !== undefined && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

const MONTH_ABBREV: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

function normalizeDate(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const dmy = t.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (dmy) {
    const mon = MONTH_ABBREV[dmy[2].toLowerCase().slice(0, 3)];
    if (mon) return `${dmy[3]}-${mon}-${dmy[1].padStart(2, '0')}`;
  }
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mo = m[1].padStart(2, '0');
    const d = m[2].padStart(2, '0');
    return `${m[3]}-${mo}-${d}`;
  }
  const d = new Date(t);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

/** Strip UI labels like " (Cal every 12 mo)" or " (no cal)" from exported equipment type text. */
function normalizeEquipmentTypeName(raw: string): string {
  return raw
    .replace(/\s*\(cal every\s+\d+\s*mo\)/gi, '')
    .replace(/\s*\(no cal\)/gi, '')
    .trim();
}

function resolveDepartmentId(
  row: Record<string, string>,
  departments: Department[]
): { id: number | null; error?: string } {
  const deptIdRaw = getCell(row, 'department_id', 'dept_id');
  if (deptIdRaw && /^\d+$/.test(deptIdRaw)) {
    const id = parseInt(deptIdRaw, 10);
    if (departments.some((d) => d.id === id)) return { id };
    return { id: null, error: `Unknown department_id ${id}` };
  }
  const nameFromDeptCol = getCell(row, 'department', 'department_name', 'dept');
  const nameFromIdCol = deptIdRaw && !/^\d+$/.test(deptIdRaw) ? deptIdRaw : '';
  const name = nameFromDeptCol || nameFromIdCol;
  if (!name) return { id: null };
  const lower = name.toLowerCase();
  const exact = departments.find((d) => d.name.toLowerCase() === lower);
  if (exact) return { id: exact.id };
  const withSite = departments.find(
    (d) => `${d.name} (${d.site_name ?? ''})`.toLowerCase() === lower
  );
  if (withSite) return { id: withSite.id };
  return { id: null, error: `Unknown department "${name}"` };
}

function resolveEquipmentTypeId(
  row: Record<string, string>,
  types: EquipmentType[]
): { id: number | null; error?: string } {
  const typeIdRaw = getCell(row, 'equipment_type_id', 'type_id');
  if (typeIdRaw && /^\d+$/.test(typeIdRaw)) {
    const id = parseInt(typeIdRaw, 10);
    if (types.some((t) => t.id === id)) return { id };
    return { id: null, error: `Unknown equipment_type_id ${id}` };
  }
  const nameFromTypeCol = getCell(row, 'equipment_type', 'type', 'equipment_type_name');
  const nameFromIdCol = typeIdRaw && !/^\d+$/.test(typeIdRaw) ? typeIdRaw : '';
  const raw = nameFromTypeCol || nameFromIdCol;
  if (!raw) return { id: null, error: 'Missing equipment type (equipment_type_id or equipment_type)' };
  const cleaned = normalizeEquipmentTypeName(raw);
  const lower = cleaned.toLowerCase();
  let found = types.find((t) => t.name.toLowerCase() === lower);
  if (!found) {
    found = types.find(
      (t) =>
        lower.startsWith(t.name.toLowerCase()) ||
        t.name.toLowerCase().startsWith(lower) ||
        raw.toLowerCase().includes(t.name.toLowerCase())
    );
  }
  if (found) return { id: found.id };
  return { id: null, error: `Unknown equipment type "${raw}"` };
}

export default function EquipmentImportModal({ onClose, onImported }: Props) {
  const { profile } = useAuth();
  const departmentRequired = profile?.role === 'company_admin' && !!profile.company_id;
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [resultLog, setResultLog] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState(0);

  useEffect(() => {
    Promise.all([api.equipmentTypes.getAll().then((t) => t as EquipmentType[]), api.departments.getAll().then((d) => d as Department[])]).then(
      ([t, d]) => {
        setTypes(t);
        setDepartments(d);
      }
    );
  }, []);

  const downloadTemplate = () => {
    const header =
      'department,equipment_type,make,model,serial_number,equipment_number,last_calibration_date,next_calibration_due,notes';
    const blob = new Blob([`${header}\n`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'equipment-import-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const runImport = async (file: File) => {
    setError('');
    setResultLog([]);
    setSuccessCount(0);
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    if (headers.length === 0 || rows.length === 0) {
      setError('The file is empty or has no data rows after the header.');
      return;
    }

    setImporting(true);
    const log: string[] = [];
    let ok = 0;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (Object.values(row).every((v) => !String(v ?? '').trim())) continue;
      const lineNum = i + 2;
      const dept = resolveDepartmentId(row, departments);
      if (dept.error) {
        log.push(`Row ${lineNum}: ${dept.error}`);
        continue;
      }
      if (departmentRequired && dept.id == null) {
        log.push(`Row ${lineNum}: department is required (use the department name, or optional department_id for numeric ID)`);
        continue;
      }
      const et = resolveEquipmentTypeId(row, types);
      if (!et.id) {
        log.push(`Row ${lineNum}: ${et.error ?? 'Equipment type error'}`);
        continue;
      }
      const make = getCell(row, 'make');
      const model = getCell(row, 'model');
      const serial = getCell(row, 'serial_number', 'serial');
      if (!make || !model || !serial) {
        log.push(`Row ${lineNum}: make, model, and serial_number are required`);
        continue;
      }
      const equipmentNumber = getCell(row, 'equipment_number', 'equip_number') || null;
      const lastCalRaw = getCell(row, 'last_calibration_date', 'last_cal');
      const nextDueRaw = getCell(row, 'next_calibration_due', 'next_cal_due', 'next_calibration');
      let lastCal = normalizeDate(lastCalRaw);
      let nextDue = normalizeDate(nextDueRaw);
      if (lastCalRaw && !lastCal) log.push(`Row ${lineNum}: warning — could not parse last_calibration_date "${lastCalRaw}"`);
      if (nextDueRaw && !nextDue) log.push(`Row ${lineNum}: warning — could not parse next_calibration_due "${nextDueRaw}"`);
      const typeMeta = types.find((t) => t.id === et.id);
      const needsCal = typeMeta?.requires_calibration === 1;
      const calMonths = typeMeta?.calibration_frequency_months;
      if (needsCal && calMonths && lastCal && !nextDue) {
        nextDue = format(addMonths(new Date(lastCal + 'T12:00:00'), calMonths), 'yyyy-MM-dd');
      }
      const notes = getCell(row, 'notes', 'note') || null;

      try {
        await api.equipment.create({
          equipment_type_id: et.id,
          department_id: dept.id ?? null,
          make,
          model,
          serial_number: serial,
          equipment_number: equipmentNumber,
          last_calibration_date: lastCal,
          next_calibration_due: nextDue,
          notes,
        });
        ok++;
      } catch (e) {
        log.push(`Row ${lineNum}: ${e instanceof Error ? e.message : 'Failed'}`);
      }
    }

    setResultLog(log);
    setSuccessCount(ok);
    if (ok > 0) onImported();
    if (ok === 0 && log.length === 0) setError('No rows were imported.');
    setImporting(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
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
            <p style={{ margin: '0 0 0.75rem' }}>
              <strong>File format:</strong> The first row must be a header with column names. Each following row is one piece of equipment.
            </p>
            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Required columns</strong> (template uses the names below):
            </p>
            <ul style={{ margin: '0 0 0.75rem 1.25rem', padding: 0 }}>
              <li>
                <code>department</code> — department name (e.g. <code>Commissioning and Qualification</code>). Optional: <code>department_id</code> for
                numeric ID; <code>department_name</code> is accepted as another column name for the same value.
              </li>
              <li>
                <code>equipment_type</code> — type name (e.g. <code>Temperature Logger</code>) or text from the app with <code>(Cal every 12 mo)</code>{' '}
                (suffix ignored). Optional: <code>equipment_type_id</code> for numeric ID.
              </li>
              <li>
                <code>make</code>, <code>model</code>, <code>serial_number</code>
              </li>
            </ul>
            <p style={{ margin: '0 0 0.5rem' }}>
              <strong>Optional columns:</strong> <code>equipment_number</code>, <code>last_calibration_date</code>,{' '}
              <code>next_calibration_due</code>, <code>notes</code>. Exports may include extra columns (<code>department_id</code>,{' '}
              <code>company_name</code>, etc.); those are optional on re-import.
            </p>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Dates: <code>YYYY-MM-DD</code>, <code>M/D/YYYY</code>, or Excel-style <code>17-Dec-2025</code>. If the type requires calibration and you set{' '}
              <code>last_calibration_date</code> but leave <code>next_calibration_due</code> blank, the due date is calculated from the type’s calibration
              interval (same as Add Equipment). Calibration PDFs are not imported — add those on the equipment detail page after import.
            </p>
            {departmentRequired && (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--accent)' }}>
                Your account requires a <code>department</code> (name) on every row, or a numeric <code>department_id</code>.
              </p>
            )}
            <p style={{ margin: 0 }}>
              <button type="button" className="btn btn-secondary" style={{ fontSize: '0.85rem' }} onClick={downloadTemplate}>
                Download header template
              </button>
            </p>
          </div>

          {(departments.length > 0 || types.length > 0) && (
            <details style={{ marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <summary style={{ cursor: 'pointer' }}>Reference: department IDs and equipment type IDs</summary>
              <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Departments</strong>
                  <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem' }}>
                    {departments.map((d) => (
                      <li key={d.id}>
                        {d.id}: {d.name}
                        {d.site_name ? ` (${d.site_name})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Equipment types</strong>
                  <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.1rem' }}>
                    {types.map((t) => (
                      <li key={t.id}>
                        {t.id}: {t.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
          )}

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Upload size={18} />
              CSV file
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={importing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void runImport(f);
              }}
              style={{ padding: '0.5rem', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 6 }}
            />
          </div>

          {importing && <p style={{ color: 'var(--text-muted)' }}>Importing…</p>}
          {successCount > 0 && (
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Successfully imported {successCount} item{successCount === 1 ? '' : 's'}.
            </p>
          )}
          {error && <p style={{ color: 'var(--danger)', marginBottom: '0.75rem' }}>{error}</p>}
          {resultLog.length > 0 && (
            <div
              style={{
                maxHeight: 180,
                overflow: 'auto',
                fontSize: '0.8rem',
                background: 'var(--bg-secondary)',
                padding: '0.75rem',
                borderRadius: 6,
                marginBottom: '0.75rem',
              }}
            >
              {resultLog.map((l, i) => (
                <div key={i} style={{ color: l.includes('warning') ? 'var(--text-muted)' : 'var(--danger)' }}>
                  {l}
                </div>
              ))}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
