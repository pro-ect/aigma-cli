import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CONFIG_DIR = join(homedir(), '.aigma');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

export interface UserConfig {
  default_canvas?: string;
}

const VALID_KEYS = ['default-canvas'] as const;
export type ConfigKey = (typeof VALID_KEYS)[number];

export function isValidKey(key: string): key is ConfigKey {
  return (VALID_KEYS as readonly string[]).includes(key);
}

export function listKeys(): readonly ConfigKey[] {
  return VALID_KEYS;
}

function keyToField(key: ConfigKey): keyof UserConfig {
  return key.replace(/-/g, '_') as keyof UserConfig;
}

export async function readConfig(): Promise<UserConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8');
    return JSON.parse(raw) as UserConfig;
  } catch (err: any) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

async function writeConfig(cfg: UserConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

export async function getConfigValue(key: ConfigKey): Promise<string | undefined> {
  const cfg = await readConfig();
  return cfg[keyToField(key)];
}

export async function setConfigValue(key: ConfigKey, value: string): Promise<void> {
  const cfg = await readConfig();
  cfg[keyToField(key)] = value;
  await writeConfig(cfg);
}

export async function unsetConfigValue(key: ConfigKey): Promise<void> {
  const cfg = await readConfig();
  delete cfg[keyToField(key)];
  await writeConfig(cfg);
}

export async function getDefaultCanvas(): Promise<string | undefined> {
  return getConfigValue('default-canvas');
}
