import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const useSSL = process.env.DB_SSL === "true" || !!process.env.DATABASE_URL;

const db = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || "postgres",
        password: String(process.env.DB_PASSWORD || ""),
        database: process.env.DB_NAME || "carbonsync_emissions",
        ssl: useSSL ? { rejectUnauthorized: false } : false,
      }
);

console.log("DB ENV CHECK:", {
  usingConnectionString: !!process.env.DATABASE_URL,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  ssl: useSSL,
  passwordExists: Boolean(process.env.DB_PASSWORD) || Boolean(process.env.DATABASE_URL),
});

export const pool = db;

export default db;