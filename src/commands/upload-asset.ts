import { uploadAsset } from '../lib/upload.js';
import { info, success, json, error, ExitCode } from '../lib/output.js';

export async function runUploadAsset(opts: { file: string; json?: boolean }): Promise<void> {
  if (!opts.file) {
    error('file path is required');
    process.exit(ExitCode.Validation);
  }

  let asset;
  try {
    asset = await uploadAsset(opts.file);
  } catch (err) {
    const msg = (err as Error).message;
    error(msg);
    process.exit(/Not authenticated/.test(msg) ? ExitCode.AuthRequired : ExitCode.Generic);
  }

  if (opts.json) {
    json(asset);
    return;
  }

  success(`Uploaded ${asset.filename} (${asset.size_bytes} bytes)`);
  info(`  URL: ${asset.url}`);
  process.stdout.write(asset.url + '\n');
}
