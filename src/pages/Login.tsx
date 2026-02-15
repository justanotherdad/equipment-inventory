import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Package } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Login() {
  const { signIn, signUp, error, loading, profile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

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
          <input
            type="password"
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
          <Link to="/pricing" style={{ fontSize: '0.9rem', color: 'var(--accent)', textDecoration: 'none' }}>
            View plans & pricing
          </Link>
        </form>
      </div>
    </div>
  );
}
