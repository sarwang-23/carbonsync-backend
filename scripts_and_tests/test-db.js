import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const password = process.env.DB_PASSWORD;

if (!password || typeof password !== "string") {
  console.error("❌ DB_PASSWORD missing or invalid in .env");
  console.error("Current DB env check:", {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD_TYPE: typeof process.env.DB_PASSWORD,
    DB_PASSWORD_LENGTH: process.env.DB_PASSWORD?.length || 0,
    DB_NAME: process.env.DB_NAME,
  });

  throw new Error("DB_PASSWORD must be a valid string in .env");
}

const db = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "postgres",
  password: String(password),
  database: process.env.DB_NAME || "postgres",
});

export default db;