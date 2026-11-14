import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../types/database";

let supabaseClient: Promise<SupabaseClient<Database>> | null = null;

export function getSupabaseClient(): Promise<SupabaseClient<Database>> {
  if (supabaseClient) return supabaseClient;

  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    throw new Error(
      "O Supabase não está configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    );
  }

  supabaseClient = import("@supabase/supabase-js").then(({ createClient }) =>
    createClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }),
  );

  return supabaseClient;
}
