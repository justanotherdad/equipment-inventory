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
  onboarding_complete?: boolean;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthState & {
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signUp: (email: string, password: string, captchaToken?: string) => Promise<void>;
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
    if (session.access_token) api.setAuthToken(session.access_token);
    // Retry once on transient failure so a page refresh doesn't bounce a valid
    // session back to the login screen because of a brief network/server hiccup.
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const p = await api.auth.getProfile();
        setProfile(p);
        setError(null);
        return;
      } catch (e) {
        lastErr = e;
        if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
      }
    }
    setProfile(null);
    setError(lastErr instanceof Error ? lastErr.message : 'Failed to load profile. Check that the server is running and schema-v3-auth-access.sql was applied.');
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
      // If there is no session we're done loading. If there IS a session we keep
      // loading=true until the profile fetch resolves (see the profile effect
      // below) so the route guard never bounces a signed-in user to /login.
      if (!s) setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.access_token) {
        api.setAuthToken(s.access_token);
      } else {
        api.setAuthToken(null);
        setLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (session?.user?.id) {
      (async () => {
        await refreshProfile();
        if (!cancelled) setLoading(false);
      })();
    } else {
      setProfile(null);
    }
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, refreshProfile]);

  const signIn = useCallback(async (email: string, password: string, captchaToken?: string) => {
    setError(null);
    if (!supabase) throw new Error('Auth not configured');
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (err) {
      setError(err.message);
      throw err;
    }
    if (data.session) api.setAuthToken(data.session.access_token);
  }, []);

  const signUp = useCallback(async (email: string, password: string, captchaToken?: string) => {
    setError(null);
    if (!supabase) throw new Error('Auth not configured');
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
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

  /** Optional idle sign-out. Set VITE_SESSION_IDLE_MINUTES=0 to disable. Default 45 minutes. */
  useEffect(() => {
    const raw = import.meta.env.VITE_SESSION_IDLE_MINUTES;
    const minutes = raw === undefined || raw === '' ? 45 : parseInt(String(raw), 10);
    if (!Number.isFinite(minutes) || minutes <= 0 || !session) return;

    const ms = minutes * 60 * 1000;
    let timeoutId: ReturnType<typeof setTimeout>;
    const bump = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        void signOut();
      }, ms);
    };
    bump();
    window.addEventListener('mousedown', bump);
    window.addEventListener('keydown', bump);
    window.addEventListener('scroll', bump, { passive: true });
    window.addEventListener('touchstart', bump, { passive: true });
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousedown', bump);
      window.removeEventListener('keydown', bump);
      window.removeEventListener('scroll', bump);
      window.removeEventListener('touchstart', bump);
    };
  }, [session, signOut]);

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
