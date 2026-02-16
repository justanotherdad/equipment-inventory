import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PasswordInput from '../components/PasswordInput';

export default function Login() {
  const { signIn, signUp, error, loading, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isSignUp) await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
    } catch {
      // Error shown via context
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setForgotError('');
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: err } = await supabase!.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (err) throw err;
      setResetSent(true);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Failed to send reset email';
      setForgotError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (profile) return <Navigate to="/dashboard" replace />;

  if (!supabase) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <Package size={40} />
            <h1>Equipment Inventory</h1>
            <p style={{ color: 'var(--danger)' }}>Auth not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</p>
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

  if (showForgotPassword) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <Package size={40} />
            <h1>Equipment Inventory</h1>
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
                onClick={() => { setShowForgotPassword(false); setResetSent(false); setForgotError(''); }}
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
              {(error || forgotError) && <p className="login-error">{forgotError || error}</p>}
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}
                onClick={() => { setShowForgotPassword(false); setForgotError(''); }}
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
          <Package size={40} />
          <h1>Equipment Inventory</h1>
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
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? (isSignUp ? 'Creating account…' : 'Signing in…') : isSignUp ? 'Sign up' : 'Sign in'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}
            onClick={() => { setIsSignUp(!isSignUp); }}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: '0.9rem', cursor: 'pointer', padding: 0 }}
            onClick={() => setShowForgotPassword(true)}
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
