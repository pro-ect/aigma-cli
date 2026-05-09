import {
  readConfig,
  setConfigValue,
  unsetConfigValue,
  isValidKey,
  listKeys,
} from '../lib/user-config.js';
import { info, json, success, error, ExitCode } from '../lib/output.js';

interface ConfigOptions {
  json?: boolean;
}

export async function runConfigGet(args: { key?: string } & ConfigOptions): Promise<void> {
  const cfg = await readConfig();
  if (!args.key) {
    if (args.json) return json(cfg);
    if (Object.keys(cfg).length === 0) return info('(no config set)');
    for (const [k, v] of Object.entries(cfg)) info(`  ${k.replace(/_/g, '-')} = ${v}`);
    return;
  }
  if (!isValidKey(args.key)) {
    error(`Unknown key "${args.key}". Valid: ${listKeys().join(', ')}`);
    process.exit(ExitCode.Validation);
  }
  const field = args.key.replace(/-/g, '_') as keyof typeof cfg;
  const v = cfg[field];
  if (args.json) return json({ key: args.key, value: v ?? null });
  if (v === undefined) info(`${args.key} is not set`);
  else process.stdout.write(`${v}\n`);
}

export async function runConfigSet(args: { key: string; value: string } & ConfigOptions): Promise<void> {
  if (!isValidKey(args.key)) {
    error(`Unknown key "${args.key}". Valid: ${listKeys().join(', ')}`);
    process.exit(ExitCode.Validation);
  }
  await setConfigValue(args.key, args.value);
  success(`Set ${args.key} = ${args.value}`);
  if (args.json) json({ ok: true, key: args.key, value: args.value });
}

export async function runConfigUnset(args: { key: string } & ConfigOptions): Promise<void> {
  if (!isValidKey(args.key)) {
    error(`Unknown key "${args.key}". Valid: ${listKeys().join(', ')}`);
    process.exit(ExitCode.Validation);
  }
  await unsetConfigValue(args.key);
  success(`Unset ${args.key}`);
  if (args.json) json({ ok: true, key: args.key });
}
