/**
 * Browser-side Supabase client initialisation for Jey's Academic Studio (/jas-hub).
 * Uses ONLY the public anon/publishable key. Never accepts a service_role or secret key.
 */

let cachedClient = null;
let pendingClientPromise = null;

/**
 * Inspect a key to make sure a service_role or secret key is never used in the browser.
 */
export function isForbiddenSecretKey(key) {
  if (typeof key !== 'string' || !key.trim()) return true;
  const trimmed = key.trim();
  if (trimmed.startsWith('sb_secret_')) return true;

  // If the key is a 3-part JWT, verify its payload role is not service_role.
  const parts = trimmed.split('.');
  if (parts.length === 3) {
    try {
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const json =
        typeof globalThis.atob === 'function'
          ? globalThis.atob(padded)
          : Buffer.from(padded, 'base64').toString('utf8');
      const payload = JSON.parse(json);
      if (payload && payload.role === 'service_role') {
        return true;
      }
    } catch {
      // Non-JSON or opaque token format; allow unless flagged above.
    }
  }
  return false;
}

/**
 * Resolve { supabaseUrl, supabaseAnonKey } from globalThis.JAS_CONFIG (js/config.js)
 * or fetch from /api/config when deployed on Vercel.
 */
export async function resolvePublicConfig() {
  const inlineConfig = globalThis.JAS_CONFIG || {};
  let supabaseUrl = (inlineConfig.supabaseUrl || '').trim();
  let supabaseAnonKey = (inlineConfig.supabaseAnonKey || '').trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    const endpoint = inlineConfig.configEndpoint || '/api/config';
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Could not load authentication configuration.');
    }
    supabaseUrl = (data.supabaseUrl || '').trim();
    supabaseAnonKey = (data.supabaseAnonKey || '').trim();
    globalThis.JAS_CONFIG = {
      ...inlineConfig,
      supabaseUrl,
      supabaseAnonKey
    };
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and anon key are required.');
  }

  if (isForbiddenSecretKey(supabaseAnonKey)) {
    throw new Error('Refusing to initialise browser Supabase client with a secret or service_role key.');
  }

  return { supabaseUrl, supabaseAnonKey };
}

/**
 * Return the singleton Supabase JS client configured for browser session storage.
 */
export async function getSupabaseClient() {
  if (cachedClient) return cachedClient;
  if (pendingClientPromise) return pendingClientPromise;

  pendingClientPromise = (async () => {
    try {
      const { supabaseUrl, supabaseAnonKey } = await resolvePublicConfig();
      const createClientFn = globalThis.supabase?.createClient;
      if (typeof createClientFn !== 'function') {
        throw new Error('Supabase JS library failed to load.');
      }
      cachedClient = createClientFn(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: globalThis.localStorage
        }
      });
      return cachedClient;
    } finally {
      pendingClientPromise = null;
    }
  })();

  return pendingClientPromise;
}

/**
 * Reset cached client instance (used in unit tests).
 */
export function resetSupabaseClientForTests(mockClient = null) {
  cachedClient = mockClient;
  pendingClientPromise = null;
}

if (typeof globalThis !== 'undefined') {
  globalThis.JAS_SUPABASE = {
    getSupabaseClient,
    resolvePublicConfig,
    isForbiddenSecretKey
  };
}
