import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Vite's `define` config only replaces *exact* string matches like
// `process.env.SUPABASE_URL`. Computed-property access (`process.env[key]`)
// stays unreplaced and evaluates to undefined in the browser. So we must
// reference each variable by its literal name below.
//
// Both unprefixed and VITE_-prefixed forms are checked so deployers can use
// whichever convention their host expects.
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  '';

const supabaseKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseKey) {
  // eslint-disable-next-line no-console
  console.error(
    'MaliMart Error: SUPABASE_URL or SUPABASE_ANON_KEY is missing. ' +
    'Authentication and Database features will be non-functional. ' +
    'Check Project → Settings → Environment Variables in Vercel.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
});
