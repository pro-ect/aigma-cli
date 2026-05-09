import { authenticatedClient, readSession } from '../lib/session.js';
import { info, json, error, ExitCode } from '../lib/output.js';

export async function runWhoami(opts: { json?: boolean }): Promise<void> {
  const stored = await readSession();
  if (!stored) {
    if (opts.json) {
      process.stdout.write(JSON.stringify({ ok: false, signed_in: false }) + '\n');
    } else {
      error('Not signed in. Run `aigma login`.');
    }
    process.exit(ExitCode.AuthRequired);
  }

  // Refresh + validate the token so we don't lie about being signed in.
  const auth = await authenticatedClient();
  if (!auth) {
    if (opts.json) {
      process.stdout.write(JSON.stringify({ ok: false, signed_in: false, detail: 'session expired' }) + '\n');
    } else {
      error('Session expired. Run `aigma login` again.');
    }
    process.exit(ExitCode.AuthRequired);
  }

  if (opts.json) {
    json({ ok: true, signed_in: true, user: { id: auth.userId, email: stored.user.email } });
    return;
  }

  info(`Signed in as ${stored.user.email ?? auth.userId}`);
  info(`  user_id: ${auth.userId}`);
}
