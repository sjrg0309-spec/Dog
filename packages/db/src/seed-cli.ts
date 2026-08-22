import { createPool } from './client.js';
import { seed } from './seed.js';

const pool = createPool();
try {
  await seed(pool);
  console.log('✓ semilla aplicada');
} finally {
  await pool.end();
}
