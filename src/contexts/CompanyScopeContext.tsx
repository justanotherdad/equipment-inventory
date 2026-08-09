import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext';

export interface ScopedCompany {
  id: number;
  name: string;
}

interface CompanyScopeState {
  /** null = all companies (Super Admin only). */
  companyId: number | null;
  companies: ScopedCompany[];
  setCompanyId: (id: number | null) => void;
  loading: boolean;
}

const STORAGE_KEY = 'equipforge_company_scope';

const CompanyScopeContext = createContext<CompanyScopeState | null>(null);

function readStoredCompanyId(): number | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw == null || raw == '' || raw === 'all') return null;
    const n = parseInt(raw, 10);
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

function persistCompanyId(id: number | null) {
  try {
    sessionStorage.setItem(STORAGE_KEY, id == null ? 'all' : String(id));
  } catch { /* ignore */ }
}

export function CompanyScopeProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const [companies, setCompanies] = useState<ScopedCompany[]>([]);
  const [companyId, setCompanyIdState] = useState<number | null>(() => readStoredCompanyId());
  const [loading, setLoading] = useState(false);

  // Keep API client scope in sync during render so child mounts/fetches never see a stale company_id
  if (isSuperAdmin) {
    api.setCompanyScope(companyId);
  } else {
    api.setCompanyScope(null);
  }

  useEffect(() => {
    if (!isSuperAdmin) {
      setCompanies([]);
      return;
    }
    setLoading(true);
    api.admin.getCompanies()
      .then((list) => setCompanies(list.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => setCompanies([]))
      .finally(() => setLoading(false));
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    persistCompanyId(companyId);
  }, [isSuperAdmin, companyId]);

  const setCompanyId = useCallback((id: number | null) => {
    api.setCompanyScope(id);
    persistCompanyId(id);
    setCompanyIdState(id);
  }, []);

  return (
    <CompanyScopeContext.Provider value={{ companyId: isSuperAdmin ? companyId : null, companies, setCompanyId, loading }}>
      {children}
    </CompanyScopeContext.Provider>
  );
}

export function useCompanyScope() {
  const ctx = useContext(CompanyScopeContext);
  if (!ctx) {
    return {
      companyId: null as number | null,
      companies: [] as ScopedCompany[],
      setCompanyId: (_id: number | null) => {},
      loading: false,
    };
  }
  return ctx;
}
