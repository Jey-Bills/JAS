/* JAS PUBLIC CONFIG — Browser-safe configuration for Supabase Auth.
   IMPORTANT: Only the public SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY)
   may ever be used in the browser. Row Level Security (RLS) enforces data access.
   NEVER put SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY in this file.
   If supabaseUrl / supabaseAnonKey are left blank here, js/supabase-client.js
   loads them automatically from /api/config (backed by Vercel environment variables). */
(function () {
  'use strict';
  const existing = globalThis.JAS_CONFIG || {};
  globalThis.JAS_CONFIG = {
    supabaseUrl: existing.supabaseUrl || '',
    supabaseAnonKey: existing.supabaseAnonKey || '',
    configEndpoint: existing.configEndpoint || '/api/config',
    ownerEmail: 'jessenyarko192@gmail.com'
  };
})();
