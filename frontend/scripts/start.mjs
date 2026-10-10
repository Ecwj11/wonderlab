import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const runtime = new URL('../.next/standalone/frontend/', import.meta.url);
await mkdir(new URL('.next/', runtime), { recursive: true });
await cp(new URL('../.next/static/', import.meta.url), new URL('.next/static/', runtime), {
  recursive: true,
});
await cp(new URL('../public/', import.meta.url), new URL('public/', runtime), { recursive: true });
process.env.PORT ||= '3000';
process.env.HOSTNAME = '0.0.0.0';
await import(fileURLToPath(new URL('server.js', runtime)));
