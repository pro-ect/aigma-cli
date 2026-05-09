import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import open from 'open';
import { writeSession, type StoredSession } from '../lib/session.js';
import { WEB_BASE } from '../lib/config.js';
import { info, success, json, exitWith } from '../lib/output.js';

interface LoginOptions {
  json?: boolean;
}

export async function runLogin(opts: LoginOptions): Promise<void> {
  const state = randomBytes(16).toString('hex');

  const session = await new Promise<StoredSession>((resolve, reject) => {
    const server = createServer((req, res) => {
      // CORS — accept any origin. The server is bound to 127.0.0.1 and
      // protected by the per-request `state` token, so origin restriction
      // adds no real security and breaks www↔apex redirects.
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204).end();
        return;
      }

      if (req.method !== 'POST' || !req.url?.startsWith('/callback')) {
        res.writeHead(404).end();
        return;
      }

      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          if (payload.state !== state) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'state mismatch' }));
            return;
          }
          if (!payload.access_token || !payload.refresh_token || !payload.user) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'missing fields' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
          server.close();
          resolve({
            access_token: payload.access_token,
            refresh_token: payload.refresh_token,
            expires_at: payload.expires_at ?? 0,
            user: { id: payload.user.id, email: payload.user.email ?? null },
          });
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid json' }));
          reject(err);
        }
      });
    });

    server.on('error', reject);

    // Bind to loopback only on a random free port.
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (typeof addr !== 'object' || !addr) {
        reject(new Error('failed to bind local server'));
        return;
      }
      const port = addr.port;
      const url = `${WEB_BASE}/cli-auth?port=${port}&state=${state}`;
      info(`Opening browser to sign in...`);
      info(`  ${url}`);
      open(url).catch(() => {
        info(`If your browser didn't open, visit the URL above.`);
      });
    });

    // 5 minute timeout.
    setTimeout(() => {
      server.close();
      reject(new Error('Login timed out — please try again.'));
    }, 5 * 60_000);
  });

  await writeSession(session);
  success(`Signed in as ${session.user.email ?? session.user.id}`);

  if (opts.json) {
    json({ ok: true, user: session.user });
  }
}
