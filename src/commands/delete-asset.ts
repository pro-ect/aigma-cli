import { authenticatedClient } from '../lib/session.js';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../lib/config.js';
import { success, json, error, ExitCode } from '../lib/output.js';

interface DeleteResp {
  ok?: boolean;
  key?: string;
  error?: string;
  detail?: string;
}

export async function runDeleteAsset(opts: { key: string; json?: boolean }): Promise<void> {
  if (!opts.key?.trim()) {
    error('key is required (e.g. cli-uploads/<user-id>/<file>)');
    process.exit(ExitCode.Validation);
  }

  const auth = await authenticatedClient();
  if (!auth) {
    error('Not authenticated. Run `aigma login` first.');
    process.exit(ExitCode.AuthRequired);
  }

  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/cli-delete-asset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ key: opts.key.trim() }),
    });
  } catch (err) {
    error(`Network error: ${(err as Error).message}`);
    process.exit(ExitCode.Generic);
  }

  let payload: DeleteResp;
  try {
    payload = (await res.json()) as DeleteResp;
  } catch {
    error(`Server returned non-JSON (status ${res.status})`);
    process.exit(ExitCode.Generic);
  }

  if (!res.ok || payload.error) {
    const msg = payload.detail ? `${payload.error}: ${payload.detail}` : payload.error || `Request failed (status ${res.status})`;
    error(msg);
    process.exit(res.status === 401 ? ExitCode.AuthRequired : ExitCode.Generic);
  }

  success(`Deleted ${opts.key}`);
  if (opts.json) json(payload);
}
