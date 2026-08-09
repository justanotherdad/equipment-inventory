import { useState, useEffect, useRef } from 'react';
import { Navigate, Link, useSearchParams } from 'react-router-dom';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getTurnstileSiteKey } from '../lib/turnstile';
import { BrandLogo } from '../components/BrandLogo';
import PasswordInput from '../components/PasswordInput';

export default function Login() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { signIn, signUp, error, loading, profile, signOut } = useAuth();
  const reauthRequested = searchParams.get('reauth') === '1';
  const turnstileSiteKey = getTurnstileSiteKey();
  const turnstileRef = useRef<TurnstileInstance>(null);

  /** Public pages link with ?reauth=1 so a stored Supabase session is cleared before showing the sign-in form. */
  useEffect(() => {
    if (!reauthRequested || !supabase) return;
    if (!profile) {
      setSearchParams(
        (p) => {
          const n = new URLSearchParams(p);
          n.delete('reauth');
          return n;
        },
        { replace: true }
      );
      return;
    }
    void signOut();
  }, [reauthRequested, profile, signOut, setSearchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [localError, setLocalError] = useState('');

  const resetCaptcha = () => {
    setCaptchaToken(null);
    turnstileRef.current?.reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (turnstileSiteKey && !captchaToken) {
      setLocalError('Please complete the human verification check.');
      return;
    }
    setSubmitting(true);
    try {
      if (isSignUp) await signUp(email.trim(), password, captchaToken ?? undefined);
      else await signIn(email.trim(), password, captchaToken ?? undefined);
    } catch {
      // Error shown via context
    } finally {
      resetCaptcha();
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLocalError('');
    setForgotError('');
    if (turnstileSiteKey && !captchaToken) {
      setForgotError('Please complete the human verification check.');
      return;
    }
    setSubmitting(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: err } = await supabase!.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
        captchaToken: captchaToken ?? undefined,
      });
      if (err) throw err;
      setResetSent(true);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Failed to send reset email';
      setForgotError(msg);
    } finally {
      resetCaptcha();
      setSubmitting(false);
    }
  };

  if (profile && !reauthRequested) return <Navigate to="/dashboard" replace />;

  if (reauthRequested && profile) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p style={{ color: 'var(--text-muted)' }}>Signing out…</p>
        </div>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <BrandLogo variant="auth" accentFallback />
            <p style={{ color: 'var(--danger)' }}>
              Auth not configured. For local dev, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env. For production,
              set SUPABASE_ANON_KEY (anon/public key from Supabase → Settings → API) alongside SUPABASE_URL on the server.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
        </div>
      </div>
    );
  }

  const captchaBlock = turnstileSiteKey ? (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '0.25rem 0' }}>
      <Turnstile
        ref={turnstileRef}
        siteKey={turnstileSiteKey}
        onSuccess={(token) => setCaptchaToken(token)}
        onExpire={() => setCaptchaToken(null)}
        onError={() => setCaptchaToken(null)}
      />
    </div>
  ) : (
    <p className="login-error">
      Human verification is not configured. Add VITE_TURNSTILE_SITE_KEY to your environment.
    </p>
  );

  if (showForgotPassword) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <BrandLogo variant="auth" accentFallback />
            <p>Reset your password</p>
          </div>
          {resetSent ? (
            <div className="login-form">
              <p style={{ color: 'var(--success)', marginBottom: '1rem' }}>
                Check your email for a link to reset your password. The link will expire in 1 hour.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setShowForgotPassword(false); setResetSent(false); setForgotError(''); setLocalError(''); }}
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="login-form">
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={submitting}
              />
              {captchaBlock}
              {(error || forgotError || localError) && (
                <p className="login-error">{forgotError || localError || error}</p>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || (Boolean(turnstileSiteKey) && !captchaToken)}
              >
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}
                onClick={() => { setShowForgotPassword(false); setForgotError(''); setLocalError(''); resetCaptcha(); }}
              >
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <BrandLogo variant="auth" accentFallback />
          <p>Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={submitting}
          />
          <PasswordInput
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            disabled={submitting}
          />
          {captchaBlock}
          {(error || localError) && <p className="login-error">{localError || error}</p>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || (Boolean(turnstileSiteKey) && !captchaToken)}
          >
            {submitting ? (isSignUp ? 'Creating account…' : 'Signing in…') : isSignUp ? 'Sign up' : 'Sign in'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}
            onClick={() => { setIsSignUp(!isSignUp); resetCaptcha(); setLocalError(''); }}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '0.9rem', cursor: 'pointer', padding: 0 }}
            onClick={() => { setShowForgotPassword(true); resetCaptcha(); setLocalError(''); }}
          >
            Forgot password?
          </button>
          <Link to="/pricing" style={{ fontSize: '0.9rem', color: 'var(--accent)', textDecoration: 'none' }}>
            View plans & pricing
          </Link>
        </form>
      </div>
    </div>
  );
}
