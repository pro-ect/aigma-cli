import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export async function runAgentHelp(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/commands/agent-help.js → ../../AGENTS.md (npm package root)
  const candidates = [
    join(here, '..', '..', 'AGENTS.md'),
    join(here, '..', '..', '..', 'AGENTS.md'),
  ];
  for (const p of candidates) {
    try {
      const md = await readFile(p, 'utf8');
      process.stdout.write(md);
      if (!md.endsWith('\n')) process.stdout.write('\n');
      return;
    } catch {
      /* try next */
    }
  }
  process.stderr.write('AGENTS.md not found in package; reinstall aigma.\n');
  process.exit(1);
}
