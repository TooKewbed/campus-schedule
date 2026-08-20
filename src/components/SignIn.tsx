import { useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { signIn, signUp } from '../lib/auth';

interface Props {
  supabase: SupabaseClient;
  /** Lets the user skip the account and keep working against this browser only. */
  onContinueOffline: () => void;
}

type Mode = 'in' | 'up';

/**
 * The gate in front of a synced schedule.
 *
 * Offering "keep it on this device" alongside the form is deliberate. Sync is
 * the reason an account exists at all, and someone who only ever opens the app
 * on one laptop gains nothing from signing up — making them do it anyway would
 * be a toll booth on the way to their own calendar.
 */
export default function SignIn({ supabase, onContinueOffline }: Props) {
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      if (mode === 'up') {
        const { needsConfirmation } = await signUp(supabase, email.trim(), password);
        // On success the session listener swaps this screen out, so there is
        // nothing to do here unless the account still needs confirming.
        if (needsConfirmation) setSentTo(email.trim());
      } else {
        await signIn(supabase, email.trim(), password);
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSentTo(null);
  }

  if (sentTo) {
    return (
      <div className="signin">
        <div className="signin-card">
          <h1 className="signin-title">Check your email</h1>
          <p className="signin-sub">
            A confirmation link is on its way to <strong>{sentTo}</strong>. Open it, then
            come back and sign in.
          </p>
          <button className="btn signin-submit" onClick={() => switchMode('in')}>
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="signin">
      <form className="signin-card" onSubmit={handleSubmit}>
        <h1 className="signin-title">Skedge</h1>
        <p className="signin-sub">
          {mode === 'in'
            ? 'Sign in to reach your schedule from any device.'
            : 'Create an account to sync across your devices.'}
        </p>

        <div className="field">
          <label className="field-label" htmlFor="signin-email">
            Email
          </label>
          <input
            id="signin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            disabled={busy}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="signin-password">
            Password
          </label>
          <input
            id="signin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            /* Tells a password manager whether to offer a saved entry or a new one. */
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            minLength={6}
            required
            disabled={busy}
          />
          {mode === 'up' && <span className="field-hint">At least 6 characters.</span>}
        </div>

        {error && (
          <p className="signin-error" role="alert">
            {error}
          </p>
        )}

        <button className="btn signin-submit" type="submit" disabled={busy}>
          {busy ? 'Working…' : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>

        <div className="signin-alt">
          {mode === 'in' ? (
            <button type="button" className="linkish" onClick={() => switchMode('up')}>
              Create an account
            </button>
          ) : (
            <button type="button" className="linkish" onClick={() => switchMode('in')}>
              I already have an account
            </button>
          )}
          <span aria-hidden="true">·</span>
          <button type="button" className="linkish" onClick={onContinueOffline}>
            Just use this device
          </button>
        </div>
      </form>
    </div>
  );
}
