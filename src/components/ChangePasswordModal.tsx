import { useState, useRef } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getTurnstileSiteKey } from '../lib/turnstile';
import PasswordInput from './PasswordInput';

interface Props {
  onClose: () => void;
}

export default function ChangePasswordModal({ onClose }: Props) {
  const { profile } = useAuth();
  const turnstileSiteKey = getTurnstileSiteKey();
  const turnstileRef = useRef<TurnstileInstance>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (turnstileSiteKey && !captchaToken) {
      setError('Please complete the human verification check.');
      return;
    }
    setSubmitting(true);
    try {
      const { error: signInErr } = await supabase!.auth.signInWithPassword({
        email: profile?.email ?? '',
        password: currentPassword,
        options: captchaToken ? { captchaToken } : undefined,
      });
      if (signInErr) {
        setError('Current password is incorrect');
        setCaptchaToken(null);
        turnstileRef.current?.reset();
        return;
      }
      const { error: updateErr } = await supabase!.auth.updateUser({ password: newPassword });
      if (updateErr) throw updateErr;
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password');
      setCaptchaToken(null);
      turnstileRef.current?.reset();
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-primary)',
    color: 'inherit',
    fontSize: '0.95rem',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '1.5rem', maxWidth: 400, width: '90%', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Change Password</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Current password</label>
            <PasswordInput
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              placeholder="Enter current password"
              style={inputStyle}
              disabled={submitting}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>New password (min 6 characters)</label>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Enter new password"
              style={inputStyle}
              disabled={submitting}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Confirm new password</label>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              placeholder="Confirm new password"
              style={inputStyle}
              disabled={submitting}
            />
          </div>
          {turnstileSiteKey && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Turnstile
                ref={turnstileRef}
                siteKey={turnstileSiteKey}
                onSuccess={(token) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken(null)}
                onError={() => setCaptchaToken(null)}
              />
            </div>
          )}
          {error && <p style={{ color: 'var(--danger)', fontSize: '0.9rem', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || (Boolean(turnstileSiteKey) && !captchaToken)}
            >
              {submitting ? 'Updating…' : 'Update password'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
