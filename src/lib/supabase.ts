import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// One client for the whole app.
//
// Created lazily and cached, rather than at module load, because the app has to
// render something sensible when the environment is not configured — a build
// served without VITE_SUPABASE_URL should show an honest message, not a white
// screen from a throw during import.

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!isConfigured) {
    throw new Error("Supabase is not configured; guard with isConfigured before calling this.");
  }
  client ??= createClient(url!, anonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // The session lands in the URL fragment after a magic link. Letting the
      // client consume it and then clearing it keeps a copyable, shareable URL
      // from carrying an access token.
      detectSessionInUrl: true,
    },
  });
  return client;
}
