import type { Session, SupabaseClient } from '@supabase/supabase-js';

/**
 * Account handling, kept to the four operations the app actually performs.
 *
 * Supabase persists the session in localStorage and refreshes the token in the
 * background on its own, so nothing here stores credentials or tracks expiry.
 * The password is handed straight to the client and never held in app state
 * beyond the keystroke that produced it.
 */

/** Signed-up but unconfirmed accounts get a user and no session. */
export interface SignUpResult {
  needsConfirmation: boolean;
}

export async function signUp(
  supabase: SupabaseClient,
  email: string,
  password: string,
): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(friendly(error.message));

  // A session comes back only when the project has email confirmation off.
  return { needsConfirmation: data.session === null };
}

export async function signIn(
  supabase: SupabaseClient,
  email: string,
  password: string,
): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(friendly(error.message));
}

export async function signOut(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(friendly(error.message));
}

/**
 * Current session plus a subscription to later changes.
 *
 * getSession resolves from localStorage, so a returning user is signed in
 * before the first paint rather than flashing the sign-in form. The listener
 * then covers sign-out, token refresh, and a second tab signing out.
 */
export function watchSession(
  supabase: SupabaseClient,
  onChange: (session: Session | null) => void,
): () => void {
  let active = true;

  supabase.auth.getSession().then(({ data }) => {
    if (active) onChange(data.session);
  });

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (active) onChange(session);
  });

  return () => {
    active = false;
    data.subscription.unsubscribe();
  };
}

/**
 * Supabase's messages are written for developers. These are the few a user can
 * actually hit, rewritten to say what to do about it; anything unrecognised is
 * passed through rather than flattened into a useless "something went wrong".
 */
function friendly(message: string): string {
  const text = message.toLowerCase();

  if (text.includes('invalid login credentials')) {
    return 'That email and password combination does not match an account.';
  }
  if (text.includes('email not confirmed')) {
    return 'Confirm your email first — check your inbox for the link.';
  }
  if (text.includes('user already registered')) {
    return 'An account already exists for that email. Try signing in instead.';
  }
  if (text.includes('password should be at least')) {
    return 'Passwords need to be at least 6 characters.';
  }
  if (text.includes('rate limit') || text.includes('too many requests')) {
    return 'Too many attempts just now. Wait a minute and try again.';
  }
  if (text.includes('failed to fetch')) {
    return 'Could not reach the server. Check your connection.';
  }
  return message;
}
