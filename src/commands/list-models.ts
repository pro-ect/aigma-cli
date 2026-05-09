import { authenticatedClient } from '../lib/session.js';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../lib/config.js';
import { info, json, error, ExitCode } from '../lib/output.js';

interface ListModelsResp {
  ok?: boolean;
  default?: string;
  models?: Array<{ id: string; label: string; provider: string }>;
  error?: string;
  detail?: string;
}

export async function runListModels(opts: { json?: boolean }): Promise<void> {
  const auth = await authenticatedClient();
  if (!auth) {
    error('Not authenticated. Run `aigma login` first.');
    process.exit(ExitCode.AuthRequired);
  }

  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/cli-list-models`, {
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

  let payload: ListModelsResp;
  try {
    payload = (await res.json()) as ListModelsResp;
  } catch {
    error(`Server returned non-JSON (status ${res.status})`);
    process.exit(ExitCode.Generic);
  }

  if (!res.ok || payload.error) {
    error(payload.detail ? `${payload.error}: ${payload.detail}` : payload.error || `Request failed (${res.status})`);
    process.exit(res.status === 401 ? ExitCode.AuthRequired : ExitCode.Generic);
  }

  if (opts.json) {
    json(payload);
    return;
  }

  const models = payload.models ?? [];
  if (models.length === 0) {
    info('(no models)');
    return;
  }
  for (const m of models) {
    const tag = m.id === payload.default ? '  (default)' : '';
    info(`  ${m.id.padEnd(38)}  ${m.label.padEnd(18)}  ${m.provider}${tag}`);
  }
}
