import db from "./test-db.js";

async function main() {
  const result = await db.query("SELECT * FROM emission_factor_mappings LIMIT 5");
  console.log(result.rows);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
