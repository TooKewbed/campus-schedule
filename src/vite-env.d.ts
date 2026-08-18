/// <reference types="vite/client" />

/**
 * Typing the env vars we actually read, so a typo in an import.meta.env key
 * is a compile error rather than a silent `undefined` at runtime.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
