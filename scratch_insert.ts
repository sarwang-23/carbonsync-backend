import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  try {
    const res = await pool.query("SELECT * FROM emission_factor_mappings WHERE region = 'GB' AND category = 'railway'");
    if (res.rows.length === 0) {
      await pool.query(
        `INSERT INTO emission_factor_mappings 
          (region, country_name, category, keywords, activity_id, preferred_source, preferred_lca_activity, parameter_name, parameter_unit, is_active)
        VALUES 
          ('GB', 'United Kingdom', 'railway', '{"railway", "train", "rail"}', 'passenger_train-route_type_national_rail', 'Climatiq', 'unknown', 'passengers', 'passenger_km', true)`
      );
      console.log('Inserted GB railway mapping');
    } else {
      console.log('GB railway already exists, updating...');
      await pool.query(
        `UPDATE emission_factor_mappings SET activity_id = 'passenger_train-route_type_national_rail', parameter_name = 'passengers', parameter_unit = 'passenger_km', preferred_source = 'Climatiq' WHERE region = 'GB' AND category = 'railway'`
      );
    }
  } catch(e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
