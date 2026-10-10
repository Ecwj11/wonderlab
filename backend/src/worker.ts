import { startWorker } from './services/jobs.js';
import { pool } from './db/pool.js';
const stop = startWorker();
async function shutdown() {
  await stop();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
