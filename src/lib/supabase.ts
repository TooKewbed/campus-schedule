import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase connection.
 *
 * This app is a plain browser bundle with no server of its own, so there is
 * exactly one client and it runs in the tab. The @supabase/ssr package and its
 * server/middleware helpers exist for frameworks that render on a server —
 * none of that applies here.
 *
 * Both values below ship inside the JavaScript bundle and are meant to. The
 * publishable key identifies the project, it does not grant access; Row Level
 * Security decides what any given signed-in user may read or write.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * False when the env vars are missing — a fresh clone with no .env.local, or a
 * deploy where the host's environment variables were never filled in.
 *
 * Callers check this instead of letting the app explode on load, so the
 * schedule still works offline against localStorage when sync is unavailable.
 */
export const isSupabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, key)
  : null;
