/** Public Turnstile site key — build-time (Vite) or runtime injection from the server. */
export function getTurnstileSiteKey(): string | undefined {
  const fromVite = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (typeof fromVite === 'string' && fromVite.trim()) return fromVite.trim();

  if (typeof window !== 'undefined') {
    const w = window as unknown as {
      __ENV__?: { VITE_TURNSTILE_SITE_KEY?: string };
    };
    const fromRuntime = w.__ENV__?.VITE_TURNSTILE_SITE_KEY;
    if (typeof fromRuntime === 'string' && fromRuntime.trim()) return fromRuntime.trim();
  }
  return undefined;
}
