import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  try {
    const mappings = [
      { cat: 'electricity', id: 'electricity-supply_grid-source_supplier_mix' },
      { cat: 'natural_gas', id: 'fuel-type_natural_gas_net-fuel_use_heat_supply' },
      { cat: 'diesel', id: 'fuel-type_heating_oil_diesel_net-fuel_use_heat_supply' },
      { cat: 'district_heating', id: 'heat_and_steam-type_district' }
    ];

    for (const m of mappings) {
      await pool.query(
        "UPDATE emission_factor_mappings SET activity_id = $1 WHERE region = 'DE' AND category = $2",
        [m.id, m.cat]
      );
      console.log(`Updated DE ${m.cat} -> ${m.id}`);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}

run();
