import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { startWorker } from './services/jobs.js';
const server = createApp().listen(config.PORT, () =>
  console.log(`Wonderlab API listening on ${config.PORT} (${config.AI_PROVIDER})`),
);
const stop = config.JOB_WORKER_ENABLED === 'true' ? startWorker() : async () => {};
async function shutdown() {
  server.close();
  await stop();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
