import { promises as fs } from 'node:fs';
import { basename, extname } from 'node:path';
import { authenticatedClient } from './session.js';
import { FUNCTIONS_BASE, SUPABASE_ANON_KEY } from './config.js';

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  html: 'text/html',
  htm: 'text/html',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
};

function detectMime(path: string): string {
  const ext = extname(path).slice(1).toLowerCase();
  return MIME_BY_EXT[ext] ?? 'application/octet-stream';
}

export interface UploadedAsset {
  url: string;
  key: string;
  bucket: string;
  content_type: string;
  size_bytes: number;
  filename: string;
}

export async function uploadAsset(filePath: string): Promise<UploadedAsset> {
  const auth = await authenticatedClient();
  if (!auth) throw new Error('Not authenticated. Run `aigma login` first.');

  const buf = await fs.readFile(filePath);
  const filename = basename(filePath);
  const content_type = detectMime(filePath);
  const data_base64 = buf.toString('base64');

  const res = await fetch(`${FUNCTIONS_BASE}/cli-upload-asset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.accessToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ filename, content_type, data_base64 }),
  });

  let payload: any;
  try {
    payload = await res.json();
  } catch {
    throw new Error(`Server returned non-JSON (status ${res.status})`);
  }
  if (!res.ok || payload.error) {
    const detail = payload.detail ? `: ${payload.detail}` : '';
    throw new Error(`${payload.error ?? 'Upload failed'}${detail}`);
  }
  return payload as UploadedAsset;
}
