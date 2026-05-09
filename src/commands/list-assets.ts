import { authenticatedClient } from '../lib/session.js';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../lib/config.js';
import { info, json, error, ExitCode } from '../lib/output.js';

interface AssetRow {
  key: string;
  url: string;
  name: string;
  size_bytes: number | null;
  content_type: string | null;
  created_at: string;
  updated_at: string;
}

interface ListResp {
  ok?: boolean;
  assets?: AssetRow[];
  error?: string;
  detail?: string;
}

export async function runListAssets(opts: { json?: boolean }): Promise<void> {
  const auth = await authenticatedClient();
  if (!auth) {
    error('Not authenticated. Run `aigma login` first.');
    process.exit(ExitCode.AuthRequired);
  }

  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/cli-list-assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: '{}',
    });
  } catch (err) {
    error(`Network error: ${(err as Error).message}`);
    process.exit(ExitCode.Generic);
  }

  let payload: ListResp;
  try {
    payload = (await res.json()) as ListResp;
  } catch {
    error(`Server returned non-JSON (status ${res.status})`);
    process.exit(ExitCode.Generic);
  }

  if (!res.ok || payload.error) {
    const msg = payload.detail ? `${payload.error}: ${payload.detail}` : payload.error || `Request failed (status ${res.status})`;
    error(msg);
    process.exit(res.status === 401 ? ExitCode.AuthRequired : ExitCode.Generic);
  }

  if (opts.json) {
    json(payload);
    return;
  }

  const rows = payload.assets ?? [];
  if (rows.length === 0) {
    info('(no assets uploaded via the CLI)');
    return;
  }
  for (const a of rows) {
    const size = a.size_bytes ? `${a.size_bytes}B` : '?';
    info(`${a.key}\t${a.content_type ?? '?'}\t${size}\t${a.url}`);
  }
}
