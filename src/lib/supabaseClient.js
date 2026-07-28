import { createClient } from '@supabase/supabase-js';

// Values copied from dashboards can pick up wrapping quotes, a BOM, or zero-width
// characters. Those characters are not legal in HTTP header values and cause
// `fetch` to throw before the authentication request ever reaches Supabase.
const cleanEnvValue = (value) => {
  if (typeof value !== 'string') return value;

  const cleaned = value
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .trim();

  return cleaned;
};

const supabaseUrl = cleanEnvValue(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = cleanEnvValue(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail fast with a clear message instead of a confusing runtime error deep in the SDK.
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY'
  );
}

// Supabase sends the project key in the `apikey` header. Fail at startup with a
// useful configuration error rather than exposing the browser's cryptic fetch
// error on the login screen.
if (/[^\x20-\x7E]/.test(supabaseAnonKey)) {
  throw new Error(
    'VITE_SUPABASE_ANON_KEY contains invalid characters. Copy the key again from Supabase.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
