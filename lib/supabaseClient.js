const { createClient } = require('@supabase/supabase-js');

// Our Express requireAuth middleware is the real access-control layer for
// end users — it checks each request's login token before anything reaches
// here. Because of that, the backend's OWN connection to Supabase uses the
// service_role key (bypasses Row Level Security entirely), not the public
// anon key. RLS on the tables now requires a genuinely logged-in Supabase
// session, which blocks anyone hitting Supabase's REST API directly with
// just the anon key (public by design, visible in the browser) — the
// backend needs a key that isn't subject to that same restriction.
//
// Falls back to the anon key only if SUPABASE_SERVICE_KEY hasn't been set
// yet in Railway — but note the app's data reads/writes will fail once RLS
// is tightened until that env var is added, since the anon key no longer
// qualifies as "authenticated".
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

module.exports = supabase;
