import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const db = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: String(process.env.DB_PASSWORD || ""),
  database: process.env.DB_NAME || "carbonsync_emissions",
});

console.log("DB ENV CHECK:", {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  passwordType: typeof process.env.DB_PASSWORD,
  passwordExists: Boolean(process.env.DB_PASSWORD),
  database: process.env.DB_NAME,
});
export const pool = db;

export default db;