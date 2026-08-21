/// <reference types="vite/client" />

// Declared rather than inherited from vite/client's index signature: naming the
// two variables means a typo in one is a compile error instead of `undefined`
// at runtime, which for the Supabase URL would surface as a failed fetch on a
// user's first analysis rather than as a build failure.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
