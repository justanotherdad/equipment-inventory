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

export function CompanyScopeProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';
  const [companies, setCompanies] = useState<ScopedCompany[]>([]);
  const [companyId, setCompanyIdState] = useState<number | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw == null || raw === '' || raw === 'all') return null;
      const n = parseInt(raw, 10);
      return Number.isNaN(n) ? null : n;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) {
      setCompanies([]);
      api.setCompanyScope(null);
      return;
    }
    setLoading(true);
    api.admin.getCompanies()
      .then((list) => setCompanies(list.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => setCompanies([]))
      .finally(() => setLoading(false));
  }, [isSuperAdmin]);

  useEffect(() => {
    if (!isSuperAdmin) {
      api.setCompanyScope(null);
      return;
    }
    api.setCompanyScope(companyId);
    try {
      sessionStorage.setItem(STORAGE_KEY, companyId == null ? 'all' : String(companyId));
    } catch { /* ignore */ }
  }, [isSuperAdmin, companyId]);

  const setCompanyId = useCallback((id: number | null) => {
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
