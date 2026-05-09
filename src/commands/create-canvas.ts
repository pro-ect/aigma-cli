import { authenticatedClient } from '../lib/session.js';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../lib/config.js';
import { success, json, error, ExitCode } from '../lib/output.js';

interface CreateCanvasResponse {
  ok?: boolean;
  canvas?: {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
    node_count: number;
    frames: unknown[];
  };
  error?: string;
  detail?: string;
}

export async function runCreateCanvas(opts: { name: string; json?: boolean }): Promise<void> {
  if (!opts.name?.trim()) {
    error('--name is required');
    process.exit(ExitCode.Validation);
  }

  const auth = await authenticatedClient();
  if (!auth) {
    error('Not authenticated. Run `aigma login` first.');
    process.exit(ExitCode.AuthRequired);
  }

  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/cli-create-canvas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ name: opts.name.trim() }),
    });
  } catch (err) {
    error(`Network error: ${(err as Error).message}`);
    process.exit(ExitCode.Generic);
  }

  let payload: CreateCanvasResponse;
  try {
    payload = (await res.json()) as CreateCanvasResponse;
  } catch {
    error(`Server returned non-JSON (status ${res.status})`);
    process.exit(ExitCode.Generic);
  }

  if (!res.ok || payload.error || !payload.canvas) {
    const msg = payload.detail ? `${payload.error}: ${payload.detail}` : payload.error || `Request failed (status ${res.status})`;
    error(msg);
    process.exit(res.status === 401 ? ExitCode.AuthRequired : ExitCode.Generic);
  }

  success(`Created canvas: ${payload.canvas.name}`);
  if (opts.json) {
    json(payload);
  } else {
    process.stderr.write(`  id: ${payload.canvas.id}\n`);
  }
}
