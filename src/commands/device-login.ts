import open from 'open';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from '../lib/config.js';
import { writeSession, type StoredSession } from '../lib/session.js';
import { info, success, json, error, ExitCode } from '../lib/output.js';

interface StartResp {
  ok?: boolean;
  code?: string;
  url?: string;
  expires_in?: number;
  error?: string;
  detail?: string;
}

interface PollResp {
  status: 'pending' | 'approved' | 'expired' | 'consumed' | 'unknown';
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  user?: { id: string; email: string | null };
  error?: string;
  detail?: string;
}

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 200; // ~10 min

async function callDeviceStart(): Promise<StartResp> {
  const res = await fetch(`${FUNCTIONS_BASE}/cli-device-start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: '{}',
  });
  return (await res.json()) as StartResp;
}

async function callDevicePoll(code: string): Promise<PollResp> {
  const res = await fetch(`${FUNCTIONS_BASE}/cli-device-poll`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ code }),
  });
  return (await res.json()) as PollResp;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

// `aigma login --device` — fully interactive: prints URL+code, polls until done.
export async function runDeviceLogin(opts: { json?: boolean; openBrowser?: boolean }): Promise<void> {
  const start = await callDeviceStart();
  if (!start.ok || !start.code || !start.url) {
    error(start.error ?? 'Failed to start device login');
    process.exit(ExitCode.Generic);
  }

  if (opts.openBrowser !== false) {
    open(start.url).catch(() => {});
  }
  info(`Open this URL and approve:`);
  info(`  ${start.url}`);
  info(`  code: ${start.code}`);

  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const r = await callDevicePoll(start.code);
    if (r.status === 'approved' && r.access_token && r.refresh_token && r.user) {
      const session: StoredSession = {
        access_token: r.access_token,
        refresh_token: r.refresh_token,
        expires_at: r.expires_at ?? 0,
        user: { id: r.user.id, email: r.user.email },
      };
      await writeSession(session);
      success(`Signed in as ${session.user.email ?? session.user.id}`);
      if (opts.json) json({ ok: true, user: session.user });
      return;
    }
    if (r.status === 'expired' || r.status === 'unknown' || r.status === 'consumed') {
      error(`Device login ${r.status}. Run \`aigma login --device\` again.`);
      process.exit(ExitCode.AuthRequired);
    }
  }
  error('Device login timed out. Run `aigma login --device` again.');
  process.exit(ExitCode.AuthRequired);
}

// `aigma device-start` — for bots: just print the code/url and exit.
export async function runDeviceStart(opts: { json?: boolean }): Promise<void> {
  const start = await callDeviceStart();
  if (!start.ok || !start.code || !start.url) {
    error(start.error ?? 'Failed to start device login');
    process.exit(ExitCode.Generic);
  }
  if (opts.json) {
    json({ ok: true, code: start.code, url: start.url, expires_in: start.expires_in });
    return;
  }
  info(`Open this URL and approve:`);
  info(`  ${start.url}`);
  info(`  code: ${start.code}`);
  process.stdout.write(start.code + '\n');
}

// `aigma device-poll <code>` — single check; saves creds on approval.
export async function runDevicePoll(opts: { code: string; json?: boolean }): Promise<void> {
  if (!opts.code?.trim()) {
    error('code is required');
    process.exit(ExitCode.Validation);
  }
  const r = await callDevicePoll(opts.code.trim().toUpperCase());

  if (r.status === 'approved' && r.access_token && r.refresh_token && r.user) {
    const session: StoredSession = {
      access_token: r.access_token,
      refresh_token: r.refresh_token,
      expires_at: r.expires_at ?? 0,
      user: { id: r.user.id, email: r.user.email },
    };
    await writeSession(session);
    if (opts.json) {
      json({ ok: true, status: 'approved', user: session.user });
    } else {
      success(`Signed in as ${session.user.email ?? session.user.id}`);
    }
    return;
  }

  if (opts.json) {
    json({ ok: false, status: r.status });
  } else {
    info(`status: ${r.status}`);
  }
  if (r.status === 'expired' || r.status === 'unknown') {
    process.exit(ExitCode.AuthRequired);
  }
}
