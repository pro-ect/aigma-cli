import { authenticatedClient, readSession } from '../lib/session.js';
import { info, json, error, ExitCode } from '../lib/output.js';

interface ExportTokenOptions {
  json?: boolean;
}

export async function runExportToken(opts: ExportTokenOptions): Promise<void> {
  // Refresh the session first so we ship a non-expired access_token.
  const auth = await authenticatedClient();
  if (!auth) {
    error('Not signed in. Run `aigma login` first, then re-run export-token.');
    process.exit(ExitCode.AuthRequired);
  }
  const session = await readSession();
  if (!session) {
    error('Could not read session after refresh. Try `aigma login` again.');
    process.exit(ExitCode.AuthRequired);
  }

  const encoded = Buffer.from(JSON.stringify(session), 'utf8').toString('base64');

  if (opts.json) {
    json({ ok: true, AIGMA_TOKEN: encoded, user: session.user });
    return;
  }

  info('Set this as AIGMA_TOKEN in your managed agent\'s environment:');
  info('');
  process.stdout.write(encoded + '\n');
  info('');
  info(`(belongs to ${session.user.email ?? session.user.id})`);
  info('Anyone with this value can act as you. Treat it as a secret.');
}
