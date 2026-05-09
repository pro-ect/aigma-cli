import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const CONFIG_DIR = join(homedir(), '.aigma');
const CREDS_PATH = join(CONFIG_DIR, 'credentials.json');

export interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email: string | null };
}

export async function readSession(): Promise<StoredSession | null> {
  // 1. AIGMA_TOKEN env (base64-encoded session JSON) takes precedence so
  //    managed agents can run non-interactively without ~/.aigma/credentials.json.
  const envToken = process.env.AIGMA_TOKEN?.trim();
  if (envToken) {
    try {
      const decoded = Buffer.from(envToken, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded) as StoredSession;
      if (parsed?.access_token && parsed?.refresh_token && parsed?.user) return parsed;
    } catch {
      throw new Error('AIGMA_TOKEN is set but not valid base64 of a session JSON. Run `aigma export-token` to mint a fresh value.');
    }
  }
  try {
    const raw = await fs.readFile(CREDS_PATH, 'utf8');
    return JSON.parse(raw) as StoredSession;
  } catch (err: any) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function writeSession(session: StoredSession): Promise<void> {
  // Skip writing to disk if the caller is using AIGMA_TOKEN — managed
  // agents may run on read-only filesystems and don't need persistent creds.
  if (process.env.AIGMA_TOKEN?.trim()) return;
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(CREDS_PATH, JSON.stringify(session, null, 2), { mode: 0o600 });
}

export async function clearSession(): Promise<void> {
  try {
    await fs.unlink(CREDS_PATH);
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err;
  }
}

// Build an authenticated Supabase client, refreshing the token if needed.
// Returns the client + the (possibly refreshed) access token to use as Bearer.
export async function authenticatedClient(): Promise<{
  client: SupabaseClient;
  accessToken: string;
  userId: string;
} | null> {
  const stored = await readSession();
  if (!stored) return null;

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.setSession({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
  });

  if (error || !data.session) {
    return null;
  }

  // If supabase-js refreshed the token, persist the new pair.
  if (
    data.session.access_token !== stored.access_token ||
    data.session.refresh_token !== stored.refresh_token
  ) {
    await writeSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token!,
      expires_at: data.session.expires_at ?? 0,
      user: { id: data.session.user.id, email: data.session.user.email ?? null },
    });
  }

  return {
    client,
    accessToken: data.session.access_token,
    userId: data.session.user.id,
  };
}
