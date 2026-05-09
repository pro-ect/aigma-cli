// Production defaults — overridable via env for development.
export const SUPABASE_URL =
  process.env.AIGMA_SUPABASE_URL ?? 'https://ekqbwjcvvuktnsuwnwnt.supabase.co';

// Public anon key. Safe to embed in CLI; matches the value the web app uses.
export const SUPABASE_ANON_KEY =
  process.env.AIGMA_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVrcWJ3amN2dnVrdG5zdXdud250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MDA5NDcsImV4cCI6MjA4NTM3Njk0N30.nQxS2LpgZ6BwkhnHpn0Lngmo6ZxRnkfo-aMmo6wWUVs';

export const WEB_BASE =
  process.env.AIGMA_WEB_BASE ?? 'https://aigma.co';

export const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
