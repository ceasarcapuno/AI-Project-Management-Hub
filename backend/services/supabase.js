// ─── Supabase Client Factory ──────────────────────────────────────────────────
// supabaseAdmin  — uses the Service Role key; bypasses RLS.
//                  Use for storage operations and admin tasks.
// getSupabaseForUser(token) — uses the user's JWT so RLS applies.
//                  Use for all data operations to honour per-user policies.
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
  );
}

// Admin client — service role, bypasses RLS.
// Use for: storage uploads/deletes, auth.getUser(), admin queries.
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Creates a Supabase client authenticated as the given user (via their JWT).
 * This client respects Row Level Security policies, ensuring users can only
 * access their own data.
 *
 * @param {string} token — The user's Supabase JWT (from Authorization header)
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function getSupabaseForUser(token) {
  return createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

module.exports = { supabaseAdmin, getSupabaseForUser };
