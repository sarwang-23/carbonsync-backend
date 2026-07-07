import 'dotenv/config';
import { pool } from './src/db.js';

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log(res.rows.map(r => r.table_name));
  } finally {
    client.release();
    await pool.end();
  }
}
main();
