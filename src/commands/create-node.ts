import { promises as fs } from 'node:fs';
import { authenticatedClient } from '../lib/session.js';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../lib/config.js';
import { getDefaultCanvas, getDefaultModel } from '../lib/user-config.js';
import { uploadAsset, type UploadedAsset } from '../lib/upload.js';
import { info, success, json, error, ExitCode } from '../lib/output.js';

interface CreateNodeOptions {
  prompt?: string;
  promptFile?: string;
  output?: string;
  canvas?: string;
  asset?: string[];
  fromNode?: string;
  model?: string;
  variants?: number;
  json?: boolean;
}

async function resolvePrompt(opts: CreateNodeOptions): Promise<string> {
  if (opts.prompt && opts.prompt.trim()) return opts.prompt.trim();
  if (opts.promptFile) {
    const txt = await fs.readFile(opts.promptFile, 'utf8');
    return txt.trim();
  }
  // Fall back to stdin if it's a pipe (not a TTY).
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks).toString('utf8').trim();
  }
  return '';
}

// NOTE: we used to inject an "AVAILABLE ASSETS" block into the prompt text
// here. That polluted the prompt node on the canvas (the user wants the
// prompt node to hold ONLY their original text). The edge function now
// owns asset describing/extracting via buildAssetContext + buildImageBucketNode,
// so we just send `prompt` + structured `assets[]` and let the server do
// the work — exactly mirroring the web's "Run on HTMLOutput" flow.

interface VariantResult {
  index: number;
  node_id: string;
  slug: string | null;
  public_url: string | null;
  html: string;
}

interface CreateNodeResponse {
  ok?: boolean;
  node_id?: string;
  draft_id?: string;
  html?: string;
  slug?: string | null;
  public_url?: string | null;
  canvas_url?: string;
  canvas?: { id: string; name: string } | null;
  source_node_id?: string | null;
  variants?: VariantResult[];
  failures?: Array<{ index: number; error: string }>;
  model?: string;
  error?: string;
  detail?: string;
  matches?: Array<{ id: string; name: string }>;
}

export async function runCreateNode(opts: CreateNodeOptions): Promise<void> {
  const promptText = await resolvePrompt(opts);
  if (!promptText) {
    error('prompt is required: pass --prompt, --prompt-file, or pipe via stdin');
    process.exit(ExitCode.Validation);
  }

  const auth = await authenticatedClient();
  if (!auth) {
    error('Not authenticated. Run `aigma login` first.');
    process.exit(ExitCode.AuthRequired);
  }

  // Resolve canvas: explicit flag > stored default > server-side fallback (most-recent).
  const canvas = opts.canvas ?? (await getDefaultCanvas());
  // Resolve model: explicit flag > stored default > server-side default.
  const model = opts.model ?? (await getDefaultModel());

  // Upload any --asset files first. The URLs go into body.assets[] —
  // the edge function turns them into a server-side ASSETS BUCKET context
  // block AND surfaces them as a connected ImageBucket node on the canvas.
  // The prompt node keeps the user's clean text.
  const uploaded: UploadedAsset[] = [];
  for (const file of opts.asset ?? []) {
    info(`Uploading asset ${file}…`);
    try {
      uploaded.push(await uploadAsset(file));
    } catch (err) {
      error(`Failed to upload ${file}: ${(err as Error).message}`);
      process.exit(ExitCode.Generic);
    }
  }

  const variants = Math.max(1, Math.min(5, Math.floor(opts.variants ?? 1)));
  if (variants > 1) {
    info(`Generating ${variants} variant${variants === 1 ? '' : 's'} on canvas "${canvas ?? 'most-recent'}"…`);
  } else {
    info(canvas ? `Generating node on canvas "${canvas}"…` : 'Generating node (most-recent canvas)…');
  }
  info('  (this can take 10–30s depending on prompt length and variant count)');

  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_BASE}/cli-create-node`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        prompt: promptText,
        ...(canvas ? { canvas } : {}),
        ...(opts.fromNode ? { from_node: opts.fromNode } : {}),
        ...(model ? { model } : {}),
        ...(variants > 1 ? { variants } : {}),
        ...(uploaded.length
          ? {
              assets: uploaded.map((a) => ({
                url: a.url,
                content_type: a.content_type,
                filename: a.filename,
              })),
            }
          : {}),
      }),
    });
  } catch (err) {
    error(`Network error: ${(err as Error).message}`);
    process.exit(ExitCode.Generic);
  }

  let payload: CreateNodeResponse;
  try {
    payload = (await res.json()) as CreateNodeResponse;
  } catch {
    error(`Server returned non-JSON response (status ${res.status})`);
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

  const results = payload.variants ?? (payload.html
    ? [{ index: 0, node_id: payload.node_id ?? '', slug: payload.slug ?? null, public_url: payload.public_url ?? null, html: payload.html }]
    : []);

  if (results.length === 0) {
    error('Server response missing html');
    process.exit(ExitCode.Generic);
  }

  if (opts.output && results[0].html) {
    if (results.length > 1) {
      // Multiple variants: write each next to the requested filename.
      for (let i = 0; i < results.length; i++) {
        const ext = opts.output.includes('.') ? opts.output.replace(/(\.[^.]+)$/, `.${i + 1}$1`) : `${opts.output}.${i + 1}`;
        await fs.writeFile(ext, results[i].html, 'utf8');
      }
      success(`Wrote ${results.length} HTML files (${opts.output} → ${opts.output.replace(/(\.[^.]+)?$/, '.{1..' + results.length + '}$1')})`);
    } else {
      await fs.writeFile(opts.output, results[0].html, 'utf8');
      success(`HTML written to ${opts.output}`);
    }
  }

  if (payload.canvas) info(`  Canvas:  ${payload.canvas.name} (${payload.canvas.id})`);
  if (payload.canvas_url) info(`  Open:    ${payload.canvas_url}`);
  for (let i = 0; i < results.length; i++) {
    const tag = results.length > 1 ? `[${i + 1}/${results.length}]` : '       ';
    if (results[i].public_url) info(`  Public:  ${tag} ${results[i].public_url}`);
  }
  if (payload.failures?.length) {
    for (const f of payload.failures) info(`  ⚠ variant #${f.index + 1} failed: ${f.error}`);
  }
  success(results.length > 1 ? `${results.length} variants created` : 'Node created');

  if (opts.json) json(payload);
}
