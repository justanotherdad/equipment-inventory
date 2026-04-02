import { createClient } from '@supabase/supabase-js';

/** Build-time (Vite .env) or runtime injection from server (see server/index.html handler). */
function getClientEnv(): { url?: string; anonKey?: string } {
  const viteUrl = import.meta.env.VITE_SUPABASE_URL;
  const viteAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (typeof viteUrl === 'string' && viteUrl && typeof viteAnon === 'string' && viteAnon) {
    return { url: viteUrl, anonKey: viteAnon };
  }
  if (typeof window !== 'undefined') {
    const w = window as unknown as {
      __ENV__?: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string };
    };
    const u = w.__ENV__?.VITE_SUPABASE_URL;
    const a = w.__ENV__?.VITE_SUPABASE_ANON_KEY;
    if (typeof u === 'string' && u && typeof a === 'string' && a) return { url: u, anonKey: a };
  }
  return {};
}

const { url, anonKey } = getClientEnv();

if (!url || !anonKey) {
  console.warn('Missing Supabase client env — set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (dev) or SUPABASE_URL + SUPABASE_ANON_KEY on the server (production).');
}

export const supabase = url && anonKey ? createClient(url, anonKey) : null;
