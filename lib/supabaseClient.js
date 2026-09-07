const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

if (!url || !key) {
  console.warn(
    '[supabaseClient] SUPABASE_URL / SUPABASE_KEY not set. ' +
    'Set them in Railway environment variables (see README).'
  );
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

module.exports = supabase;
