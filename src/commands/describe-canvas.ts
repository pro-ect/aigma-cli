import { authenticatedClient } from '../lib/session.js';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../lib/config.js';
import { getDefaultCanvas } from '../lib/user-config.js';
import { info, json, error, ExitCode } from '../lib/output.js';

interface DescribeCanvasResponse {
  ok?: boolean;
  canvas?: {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
    node_count: number;
    frames: Array<{ id: string; name: string; type: string }>;
  };
  matches?: Array<{ id: string; name: string }>;
  error?: string;
  detail?: string;
}

export async function runDescribeCanvas(opts: { canvas?: string; json?: boolean }): Promise<void> {
  const canvas = opts.canvas?.trim() || (await getDefaultCanvas());
  if (!canvas) {
    error('canvas (id or name) is required — pass one or run `aigma config set default-canvas <id>`');
    process.exit(ExitCode.Validation);
  }

  const auth = await authenticatedClient();
  if (!auth) {
    error('Not authenticated. Run `aigma login` first.');
    process.exit(ExitCode.AuthRequired);
  }

  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/cli-describe-canvas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ canvas }),
    });
  } catch (err) {
    error(`Network error: ${(err as Error).message}`);
    process.exit(ExitCode.Generic);
  }

  let payload: DescribeCanvasResponse;
  try {
    payload = (await res.json()) as DescribeCanvasResponse;
  } catch {
    error(`Server returned non-JSON (status ${res.status})`);
    process.exit(ExitCode.Generic);
  }

  if (!res.ok || payload.error || !payload.canvas) {
    const msg = payload.detail ? `${payload.error}: ${payload.detail}` : payload.error || `Request failed (status ${res.status})`;
    error(msg);
    if (payload.matches?.length) {
      for (const m of payload.matches) info(`  ${m.id}  ${m.name}`);
    }
    process.exit(res.status === 401 ? ExitCode.AuthRequired : ExitCode.Generic);
  }

  if (opts.json) {
    json(payload);
    return;
  }

  const c = payload.canvas;
  info(`${c.name}  (${c.id})`);
  info(`  ${c.node_count} node(s), updated ${c.updated_at}`);
  if (c.frames.length === 0) {
    info('  (no top-level frames)');
  } else {
    for (const f of c.frames) {
      info(`  • ${f.name}  [${f.type}]  ${f.id}`);
    }
  }
}
