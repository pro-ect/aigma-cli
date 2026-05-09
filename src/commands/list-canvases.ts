import { authenticatedClient } from '../lib/session.js';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../lib/config.js';
import { info, json, error, ExitCode } from '../lib/output.js';

interface CanvasSummary {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  node_count: number;
  frames: Array<{ id: string; name: string; type: string }>;
}

interface ListCanvasesResponse {
  ok?: boolean;
  canvases?: CanvasSummary[];
  error?: string;
  detail?: string;
}

export async function runListCanvases(opts: { json?: boolean }): Promise<void> {
  const auth = await authenticatedClient();
  if (!auth) {
    error('Not authenticated. Run `aigma login` first.');
    process.exit(ExitCode.AuthRequired);
  }

  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/cli-list-canvases`, {
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

  let payload: ListCanvasesResponse;
  try {
    payload = (await res.json()) as ListCanvasesResponse;
  } catch {
    error(`Server returned non-JSON (status ${res.status})`);
    process.exit(ExitCode.Generic);
  }

  if (!res.ok || payload.error) {
    const msg = payload.detail ? `${payload.error}: ${payload.detail}` : payload.error || `Request failed (status ${res.status})`;
    error(msg);
    process.exit(res.status === 401 ? ExitCode.AuthRequired : ExitCode.Generic);
  }

  const canvases = payload.canvases ?? [];

  if (opts.json) {
    json(payload);
    return;
  }

  if (canvases.length === 0) {
    info('No canvases yet. Create one with `aigma create-canvas --name "<name>"`.');
    return;
  }

  for (const c of canvases) {
    const frameNames = c.frames.map((f) => f.name).join(', ');
    info(`  ${c.id}  ${c.name}  (${c.node_count} nodes${frameNames ? `: ${frameNames}` : ''})`);
  }
}
