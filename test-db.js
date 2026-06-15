import db from "./db.js";

async function testDB() {
  try {
    const result = await db.query("SELECT NOW()");
    console.log("Database connected successfully:", result.rows[0]);
  } catch (error) {
    console.error("Database connection failed:", error.message);
  } finally {
    process.exit();
  }
}

testDB();