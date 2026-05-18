import { createClient } from '@supabase/supabase-js';

// --- Environment Variable Helper ---
const getEnvVar = (key: string) => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || 
           process.env[`NEXT_PUBLIC_${key}`] || 
           process.env[`VITE_${key}`] || 
           process.env[`REACT_APP_${key}`];
  }
  return undefined;
};

// Use provided credentials as defaults if environment variables are missing
const supabaseUrl = getEnvVar('SUPABASE_URL') || 'https://ubpapxdmqlepynonhaeo.supabase.co';
const supabaseKey = getEnvVar('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVicGFweGRtcWxlcHlub25oYWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0ODU2NTQsImV4cCI6MjA4MTA2MTY1NH0.kjkY_jrvek-7pp2KWQytVzxxK9LL2SL1sPhsMLnGBSY';

if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
    console.error("MaliMart Error: Supabase URL or Key is missing. Authentication and Database features will be non-functional.");
}

export const supabase = createClient(
    supabaseUrl, 
    supabaseKey, 
    {
        auth: {
            persistSession: true,
            detectSessionInUrl: true,
            autoRefreshToken: true
        },
        db: {
            schema: 'public'
        }
    }
);
