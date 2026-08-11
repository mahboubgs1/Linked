/**
 * Minimal CLI helpers — argument parsing and consistent output. No dependencies.
 *
 * Usage: `npm run <script> -- --key value --flag`
 */

export type Args = Record<string, string | boolean>;

/** Parse `--key value` and `--flag` style arguments from process.argv. */
export function parseArgs(argv: string[] = process.argv.slice(2)): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

export function getString(args: Args, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

export function getFlag(args: Args, key: string): boolean {
  return args[key] === true || args[key] === 'true';
}

export const line = (char = '─', n = 60): string => char.repeat(n);

/** Run a command's async main and exit with a clean error message on failure. */
export function run(main: () => Promise<void> | void): void {
  Promise.resolve()
    .then(main)
    .catch((err: unknown) => {
      console.error(`\n✖ ${(err as Error).message}\n`);
      process.exitCode = 1;
    });
}
