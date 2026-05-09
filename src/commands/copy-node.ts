import { authenticatedClient } from '../lib/session.js';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../lib/config.js';
import { getDefaultCanvas } from '../lib/user-config.js';
import { info, success, json, error, ExitCode } from '../lib/output.js';

interface CloneResp {
  ok?: boolean;
  node_id?: string;
  draft_id?: string;
  source_node_id?: string;
  html?: string;
  slug?: string | null;
  public_url?: string | null;
  canvas_url?: string;
  canvas?: { id: string; name: string } | null;
  error?: string;
  detail?: string;
  matches?: Array<{ id: string; name: string }>;
}

export async function runCopyNode(opts: { sourceId: string; canvas?: string; json?: boolean }): Promise<void> {
  if (!opts.sourceId?.trim()) {
    error('source node id is required');
    process.exit(ExitCode.Validation);
  }

  const auth = await authenticatedClient();
  if (!auth) {
    error('Not authenticated. Run `aigma login` first.');
    process.exit(ExitCode.AuthRequired);
  }

  const canvas = opts.canvas ?? (await getDefaultCanvas());

  info(`Copying node ${opts.sourceId}…`);

  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/cli-clone-node`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        source_node_id: opts.sourceId.trim(),
        ...(canvas ? { canvas } : {}),
      }),
    });
  } catch (err) {
    error(`Network error: ${(err as Error).message}`);
    process.exit(ExitCode.Generic);
  }

  let payload: CloneResp;
  try {
    payload = (await res.json()) as CloneResp;
  } catch {
    error(`Server returned non-JSON (status ${res.status})`);
    process.exit(ExitCode.Generic);
  }

  if (!res.ok || payload.error) {
    const msg = payload.detail ? `${payload.error}: ${payload.detail}` : payload.error || `Request failed (status ${res.status})`;
    error(msg);
    if (payload.matches?.length) {
      for (const m of payload.matches) info(`  ${m.id}  ${m.name}`);
    }
    process.exit(res.status === 401 ? ExitCode.AuthRequired : ExitCode.Generic);
  }

  if (payload.canvas) info(`  Canvas:  ${payload.canvas.name} (${payload.canvas.id})`);
  if (payload.public_url) info(`  Public:  ${payload.public_url}`);
  if (payload.canvas_url) info(`  Open:    ${payload.canvas_url}`);
  success(`Cloned ${opts.sourceId} → ${payload.node_id}`);

  if (opts.json) json(payload);
}
