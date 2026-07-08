import { pool } from "./src/db.js";

async function run() {
  try {
    const res = await pool.query("select category, factor, unit, is_active from india_fixed_emission_factors where category = 'electricity'");
    console.log("Existing rows:", res.rows);
    if (res.rows.length === 0) {
      await pool.query(`
        insert into india_fixed_emission_factors
        (category, factor_name, factor, unit, source, source_dataset, year, notes, keywords, is_active)
        values
        (
          'electricity',
          'India fixed electricity emission factor',
          0.710,
          'kg/kWh',
          'Internal fixed India EF',
          'CarbonSync India fixed factors',
          2025,
          'Fixed electricity EF for India.',
          array['electricity','power bill','electric bill','kwh','unit consumed','energy charges','dhbvn','uppcl','bses','tata power','adani electricity'],
          true
        )
        on conflict (category, unit) do update set
        factor = excluded.factor,
        is_active = true,
        updated_at = now();
      `);
      console.log("Inserted fixed electricity factor.");
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
