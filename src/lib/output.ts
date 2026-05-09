import pc from 'picocolors';

// Human-readable lines go to stderr so stdout stays clean for --json piping.
export function info(msg: string): void {
  process.stderr.write(msg + '\n');
}

export function success(msg: string): void {
  process.stderr.write(pc.green('✓ ') + msg + '\n');
}

export function warn(msg: string): void {
  process.stderr.write(pc.yellow('! ') + msg + '\n');
}

export function error(msg: string): void {
  process.stderr.write(pc.red('✗ ') + msg + '\n');
}

export function json(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

export function exitWith(code: number, msg?: string): never {
  if (msg) error(msg);
  process.exit(code);
}

export const ExitCode = {
  Ok: 0,
  Generic: 1,
  Validation: 2,
  AuthRequired: 3,
} as const;
