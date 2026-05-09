import { authenticatedClient } from '../lib/session.js';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../lib/config.js';
import { runCreateNode } from './create-node.js';
import { info, error, ExitCode } from '../lib/output.js';

interface DoOptions {
  prompt: string;
  json?: boolean;
  output?: string;
  asset?: string[];
}

const STOP = new Set([
  'a','an','the','of','for','to','and','or','on','in','at','with','my',
  'me','build','make','create','new','add','please','some','this','that',
  'is','are','it','its','as','from','by','about','using','use','i','our',
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function pickCanvas(prompt: string, canvases: Array<{ id: string; name: string }>): { id: string; name: string } | null {
  const pTokens = new Set(tokens(prompt));
  if (pTokens.size === 0 || canvases.length === 0) return null;
  let best: { c: { id: string; name: string }; score: number } | null = null;
  for (const c of canvases) {
    const cTokens = tokens(c.name);
    const score = cTokens.filter((t) => pTokens.has(t)).length;
    if (score > 0 && (!best || score > best.score)) best = { c, score };
  }
  return best?.c ?? null;
}

function deriveCanvasName(prompt: string): string {
  const t = tokens(prompt).slice(0, 4);
  if (t.length === 0) return 'CLI project';
  return t.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
}

async function listCanvases(accessToken: string): Promise<Array<{ id: string; name: string }>> {
  const res = await fetch(`${FUNCTIONS_BASE}/cli-list-canvases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: '{}',
  });
  const payload = (await res.json()) as { canvases?: Array<{ id: string; name: string }>; error?: string };
  if (!res.ok || payload.error) throw new Error(payload.error ?? `list-canvases failed (${res.status})`);
  return payload.canvases ?? [];
}

async function createCanvas(accessToken: string, name: string): Promise<{ id: string; name: string }> {
  const res = await fetch(`${FUNCTIONS_BASE}/cli-create-canvas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ name }),
  });
  const payload = (await res.json()) as { canvas?: { id: string; name: string }; error?: string };
  if (!res.ok || payload.error || !payload.canvas) {
    throw new Error(payload.error ?? `create-canvas failed (${res.status})`);
  }
  return payload.canvas;
}

export async function runDo(opts: DoOptions): Promise<void> {
  if (!opts.prompt?.trim()) {
    error('prompt is required');
    process.exit(ExitCode.Validation);
  }

  const auth = await authenticatedClient();
  if (!auth) {
    error('Not authenticated. Run `aigma login` first.');
    process.exit(ExitCode.AuthRequired);
  }

  info('Resolving canvas…');
  let canvases: Array<{ id: string; name: string }>;
  try {
    canvases = await listCanvases(auth.accessToken);
  } catch (err) {
    error((err as Error).message);
    process.exit(ExitCode.Generic);
  }

  let target = pickCanvas(opts.prompt, canvases);
  if (target) {
    info(`  → matched existing canvas "${target.name}"`);
  } else {
    const name = deriveCanvasName(opts.prompt);
    info(`  → no match, creating canvas "${name}"`);
    try {
      target = await createCanvas(auth.accessToken, name);
    } catch (err) {
      error((err as Error).message);
      process.exit(ExitCode.Generic);
    }
  }

  await runCreateNode({
    prompt: opts.prompt,
    canvas: target.id,
    asset: opts.asset,
    output: opts.output,
    json: opts.json,
  });
}
