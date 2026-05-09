import { authenticatedClient } from '../lib/session.js';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../lib/config.js';
import { getDefaultCanvas } from '../lib/user-config.js';
import { info, json, error, ExitCode } from '../lib/output.js';

interface DescribeResp {
  ok?: boolean;
  canvas?: {
    id: string;
    name: string;
    node_count: number;
    frames: Array<{ id: string; name: string; type: string }>;
  };
  matches?: Array<{ id: string; name: string }>;
  error?: string;
  detail?: string;
}

export async function runListNodes(opts: { canvas?: string; json?: boolean }): Promise<void> {
  const canvas = opts.canvas?.trim() || (await getDefaultCanvas());
  if (!canvas) {
    error('--canvas is required — pass one or set a default with `aigma config set default-canvas <id>`');
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

  let payload: DescribeResp;
  try {
    payload = (await res.json()) as DescribeResp;
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
    json({ ok: true, canvas: payload.canvas.id, frames: payload.canvas.frames });
    return;
  }

  if (payload.canvas.frames.length === 0) {
    info(`(no frames on canvas ${payload.canvas.name})`);
    return;
  }
  for (const f of payload.canvas.frames) {
    info(`${f.id}\t${f.type}\t${f.name}`);
  }
}
