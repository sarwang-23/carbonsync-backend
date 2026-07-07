import { pool } from './src/db.js';

async function setupDB() {
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    console.log("pg_trgm enabled.");
  } catch (e) {
    console.error("Error enabling pg_trgm:", e);
  } finally {
    await pool.end();
  }
}
setupDB();
