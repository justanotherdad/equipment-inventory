import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';

export interface AdminTableColumn<T> {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (row: T) => React.ReactNode;
  value?: (row: T) => string | number | null | undefined;
}

interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  renderActions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
}

export function AdminTable<T extends Record<string, unknown>>({
  columns,
  data,
  searchPlaceholder = 'Search…',
  searchKeys,
  renderActions,
  emptyMessage = 'No data',
}: AdminTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const filteredAndSorted = useMemo(() => {
    let result = [...data];

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const keys = searchKeys ?? columns.map((c) => c.key).filter((k) => typeof data[0]?.[k] === 'string' || typeof data[0]?.[k] === 'number');
      result = result.filter((row) =>
        keys.some((k) => {
          const v = row[k];
          return v != null && String(v).toLowerCase().includes(q);
        })
      );
    }

    // Column filters
    for (const [colKey, filterVal] of Object.entries(columnFilters)) {
      if (!filterVal?.trim()) continue;
      const col = columns.find((c) => c.key === colKey);
      const getVal = col?.value ?? ((r: T) => r[colKey as keyof T]);
      const q = filterVal.trim().toLowerCase();
      result = result.filter((row) => {
        const v = getVal(row);
        return v != null && String(v).toLowerCase().includes(q);
      });
    }

    // Sort
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      const getVal = col?.value ?? ((r: T) => r[sortKey as keyof T]);
      result.sort((a, b) => {
        const va = getVal(a);
        const vb = getVal(b);
        const cmp = va == null && vb == null ? 0 : va == null ? 1 : vb == null ? -1 : String(va).localeCompare(String(vb), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [data, search, sortKey, sortDir, columnFilters, columns, searchKeys]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.5rem 0.5rem 2.25rem',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              color: 'inherit',
            }}
          />
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: '0.5rem 0.75rem',
                    textAlign: 'left',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <button
                      type="button"
                      onClick={() => col.sortable !== false && handleSort(col.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        cursor: col.sortable !== false ? 'pointer' : 'default',
                        padding: 0,
                        fontWeight: 'inherit',
                      }}
                    >
                      {col.label}
                      {col.sortable !== false && sortKey === col.key && (
                        sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </button>
                    {col.filterable && (
                      <input
                        type="text"
                        placeholder={`Filter ${col.label}`}
                        value={columnFilters[col.key] ?? ''}
                        onChange={(e) => setColumnFilters((prev) => ({ ...prev, [col.key]: e.target.value }))}
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.8rem',
                          borderRadius: 4,
                          border: '1px solid var(--border)',
                          background: 'var(--bg-primary)',
                          color: 'inherit',
                        }}
                      />
                    )}
                  </div>
                </th>
              ))}
              {renderActions && <th style={{ padding: '0.5rem 0.75rem', width: 1 }} />}
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (renderActions ? 1 : 0)} style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                  {columns.map((col) => (
                    <td key={col.key} style={{ padding: '0.5rem 0.75rem' }}>
                      {col.render ? col.render(row) : (row[col.key as keyof T] as React.ReactNode)}
                    </td>
                  ))}
                  {renderActions && (
                    <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>
                      {renderActions(row)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
