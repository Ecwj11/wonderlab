import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db/pool.js';
import {
  claimCodexRequest,
  completeCodexRequest,
  failCodexRequest,
  renewCodexRequest,
} from '../services/codex-bridge.js';

// Trusted local operator CLI only. No HTTP endpoint or AI-supplied command is exposed.
export async function codexBridgeCli(args: string[]): Promise<unknown> {
  const [command, ...rest] = args,
    flags = new Map<string, string>();
  if (rest.length % 2) throw new Error('Invalid bridge arguments');
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i].startsWith('--') || flags.has(rest[i]))
      throw new Error('Invalid bridge arguments');
    flags.set(rest[i], rest[i + 1]);
  }
  const required = (name: string) => {
    const value = flags.get(name);
    if (!value) throw new Error('Missing bridge argument');
    return value;
  };
  const allowed =
    command === 'claim'
      ? ['--worker', '--wait-seconds', '--lease-seconds']
      : command === 'complete'
        ? ['--id', '--token', '--file']
        : command === 'renew'
          ? ['--id', '--token', '--lease-seconds']
          : command === 'fail'
            ? ['--id', '--token']
            : [];
  if (!allowed.length || [...flags.keys()].some((flag) => !allowed.includes(flag)))
    throw new Error('Invalid bridge command');
  const lease = Number(flags.get('--lease-seconds') ?? 300);
  if (command === 'claim') {
    const worker = required('--worker'),
      wait = Number(flags.get('--wait-seconds') ?? 0);
    if (!Number.isInteger(wait) || wait < 0 || wait > 60)
      throw new Error('Invalid bridge wait duration');
    const until = Date.now() + wait * 1000;
    do {
      const claim = await claimCodexRequest(worker, lease);
      if (claim) return claim;
      if (Date.now() >= until) return null;
      await new Promise((resolve) => setTimeout(resolve, 500));
    } while (Date.now() <= until);
    return null;
  }
  const id = required('--id'),
    token = required('--token');
  if (command === 'complete') {
    const file = required('--file');
    if (!isAbsolute(file)) throw new Error('Bridge output file must have an absolute path');
    const info = await stat(file);
    if (!info.isFile() || info.size > 1500000) throw new Error('Invalid bridge output file');
    await completeCodexRequest(id, token, JSON.parse(await readFile(file, 'utf8')));
  } else if (command === 'fail') await failCodexRequest(id, token);
  else await renewCodexRequest(id, token, lease);
  return { ok: true, id };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  codexBridgeCli(process.argv.slice(2))
    .then((result) => console.log(JSON.stringify(result)))
    .catch(() => {
      console.error(
        JSON.stringify({
          error:
            'Codex bridge operation rejected: invalid input, expired claim, or inactive generation attempt.',
        }),
      );
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
