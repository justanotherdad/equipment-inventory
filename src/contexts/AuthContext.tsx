import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { api } from '../api';

export type Role = 'user' | 'equipment_manager' | 'company_admin' | 'super_admin';

export interface Profile {
  id: number;
  auth_user_id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  role: Role;
  company_id?: number | null;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const p = await api.auth.getProfile();
      setProfile(p);
      api.setAuthToken(session.access_token);
      setError(null);
    } catch (e) {
      setProfile(null);
      setError(e instanceof Error ? e.message : 'Failed to load profile. Check that the server is running and schema-v3-auth-access.sql was applied.');
    }
  }, [session?.user?.id, session?.access_token]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.access_token) api.setAuthToken(s.access_token);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.access_token) api.setAuthToken(s.access_token);
      else api.setAuthToken(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) refreshProfile();
    else setProfile(null);
  }, [session?.user?.id, refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    if (!supabase) throw new Error('Auth not configured');
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      throw err;
    }
    if (data.session) api.setAuthToken(data.session.access_token);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null);
    if (!supabase) throw new Error('Auth not configured');
    const { data, error: err } = await supabase.auth.signUp({ email, password });
    if (err) {
      setError(err.message);
      throw err;
    }
    if (data.session) api.setAuthToken(data.session.access_token);
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    api.setAuthToken(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        error,
      signIn,
      signUp,
      signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
