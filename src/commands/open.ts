import open from 'open';
import { WEB_BASE } from '../lib/config.js';
import { info, success, exitWith } from '../lib/output.js';

interface OpenOptions {
  published?: string;
  draft?: string;
}

export async function runOpen(opts: OpenOptions): Promise<void> {
  let url: string;
  if (opts.published) {
    url = `${WEB_BASE}/p/${opts.published}`;
  } else if (opts.draft) {
    url = `${WEB_BASE}/nodes?draft=${opts.draft}`;
  } else {
    url = `${WEB_BASE}/nodes`;
  }

  info(`Opening ${url}`);
  try {
    await open(url);
    success('Opened');
  } catch (err) {
    exitWith(1, `Failed to open browser: ${(err as Error).message}`);
  }
}
