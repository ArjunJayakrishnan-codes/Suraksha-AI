import { createClient } from '@supabase/supabase-js'

let cachedSupabaseClient: ReturnType<typeof createClient> | null = null

function getSupabaseClient() {
  if (cachedSupabaseClient) return cachedSupabaseClient

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || window.__APP_CONFIG__?.supabaseUrl
  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    window.__APP_CONFIG__?.supabasePublishableKey ||
    import.meta.env.VITE_SUPABASE_ANON_KEY

  console.log("[Supabase] Initializing client:", {
    urlSource: SUPABASE_URL ? (import.meta.env.VITE_SUPABASE_URL ? "build-time" : "runtime") : "missing",
    keySource: SUPABASE_PUBLISHABLE_KEY 
      ? (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ? "PUBLISHABLE_KEY" : import.meta.env.VITE_SUPABASE_ANON_KEY ? "ANON_KEY" : "runtime")
      : "missing",
  });

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    console.error("[Supabase] Configuration incomplete:", {
      url: SUPABASE_URL ? "present" : "MISSING",
      key: SUPABASE_PUBLISHABLE_KEY ? "present" : "MISSING",
      runtimeConfig: window.__APP_CONFIG__ || "not set",
    });
    return null
  }

  cachedSupabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  })

  return cachedSupabaseClient
}

export const isSupabaseConfigured = () => {
  const client = getSupabaseClient()
  return client !== null
}

export function getSupabase() {
  return getSupabaseClient()
}

// Lazy getter for backward compatibility
Object.defineProperty(globalThis, '__supabaseClient', {
  get: () => getSupabaseClient(),
  configurable: true,
})

export { getSupabaseClient as supabase }
