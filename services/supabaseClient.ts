import { createClient } from '@supabase/supabase-js';

// --- Environment Variable Helper ---
const getEnvVar = (key: string) => {
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env[key] ||
      process.env[`NEXT_PUBLIC_${key}`] ||
      process.env[`VITE_${key}`] ||
      process.env[`REACT_APP_${key}`]
    );
  }
  return undefined;
};

const supabaseUrl = getEnvVar('SUPABASE_URL');
const supabaseKey = getEnvVar('SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.error(
    'MaliMart Error: SUPABASE_URL or SUPABASE_ANON_KEY is missing. Authentication and Database features will be non-functional.'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true,
  },
  db: {
    schema: 'public',
  },
});
