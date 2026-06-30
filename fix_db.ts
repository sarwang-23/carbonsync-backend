import { pool } from './src/db.js';

async function update() {
  try {
    await pool.query(`
      update emission_factor_mappings
      set parameter_name = 'energy',
          parameter_unit = 'kWh',
          data_version = '^6',
          updated_at = now()
      where region = 'DE' and (parameter_name is null or parameter_name = '');
    `);
    console.log('Database updated successfully');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}
update();
