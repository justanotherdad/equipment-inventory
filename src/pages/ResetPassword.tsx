import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PasswordInput from '../components/PasswordInput';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    if (!supabase) {
      setHasSession(false);
      return;
    }
    const checkSession = () => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setHasSession(true);
          setError('');
        } else {
          setHasSession(false);
          const hash = window.location.hash;
          if (hash && hash.includes('type=recovery')) {
            setError('Invalid or expired reset link. Please request a new one.');
          } else {
            setError('No reset link detected. Please use the link from your email.');
          }
        }
      });
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      if (session) setError('');
    });
    checkSession();
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      const { error: err } = await supabase!.auth.updateUser({ password });
      if (err) throw err;
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setSubmitting(false);
    }
  };

  if (!supabase) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p style={{ color: 'var(--danger)' }}>Auth not configured.</p>
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
          <p>Set new password</p>
        </div>
        {success ? (
          <div className="login-form">
            <p style={{ color: 'var(--success)', marginBottom: '1rem' }}>
              Your password has been updated. Redirecting…
            </p>
          </div>
        ) : hasSession === true ? (
          <form onSubmit={handleSubmit} className="login-form">
            <PasswordInput
              placeholder="New password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              disabled={submitting}
            />
            <PasswordInput
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              disabled={submitting}
            />
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Updating…' : 'Update password'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer' }}
              onClick={() => navigate('/login')}
            >
              Back to sign in
            </button>
          </form>
        ) : hasSession === false ? (
          <div className="login-form">
            {error && <p className="login-error" style={{ marginBottom: '1rem' }}>{error}</p>}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/login')}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <div className="login-form">
            <p style={{ color: 'var(--text-muted)' }}>Loading…</p>
          </div>
        )}
      </div>
    </div>
  );
}
