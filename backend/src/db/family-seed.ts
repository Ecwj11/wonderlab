import { seedFamilies } from './seed.js';
import { pool } from './pool.js';
seedFamilies()
  .then(() => {
    console.log('Seeded family demo accounts without changing existing lessons.');
    return pool.end();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
    return pool.end();
  });
