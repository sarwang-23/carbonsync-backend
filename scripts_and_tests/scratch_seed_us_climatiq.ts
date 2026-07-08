import 'dotenv/config';
import { pool } from './src/db.js';

async function run() {
  // Insert US Climatiq mappings for freight, railway, flight
  const upserts = [
    {
      region: 'US',
      country_name: 'United States',
      category: 'freight',
      activity_id: 'freight_vehicle-vehicle_type_hgv-fuel_source_diesel',
      parameter_name: 'distance',
      parameter_unit: 'km',
      data_version: '^21',
      preferred_source: 'Climatiq',
      priority: 90,
      confidence_score: 0.9,
      notes: 'US HGV road freight via Climatiq',
    },
    {
      region: 'US',
      country_name: 'United States',
      category: 'railway',
      activity_id: 'passenger_train-route_type_national_rail-fuel_source_na',
      parameter_name: 'distance',
      parameter_unit: 'km',
      data_version: '^21',
      preferred_source: 'Climatiq',
      priority: 90,
      confidence_score: 0.9,
      notes: 'US national rail passenger via Climatiq',
    },
    {
      region: 'US',
      country_name: 'United States',
      category: 'flight',
      activity_id: 'passenger_flight-route_type_domestic-aircraft_type_average-distance_na-class_unknown',
      parameter_name: 'distance',
      parameter_unit: 'km',
      data_version: '^21',
      preferred_source: 'Climatiq',
      priority: 90,
      confidence_score: 0.9,
      notes: 'US domestic flight via Climatiq',
    },
  ];

  for (const m of upserts) {
    // Check if a Climatiq mapping already exists for this region+category
    const existing = await pool.query(
      `SELECT id FROM emission_factor_mappings WHERE region=$1 AND category=$2 AND preferred_source='Climatiq'`,
      [m.region, m.category]
    );

    if (existing.rows.length > 0) {
      // Update the existing record
      await pool.query(
        `UPDATE emission_factor_mappings 
         SET activity_id=$1, parameter_name=$2, parameter_unit=$3, data_version=$4, updated_at=now()
         WHERE region=$5 AND category=$6 AND preferred_source='Climatiq'`,
        [m.activity_id, m.parameter_name, m.parameter_unit, m.data_version, m.region, m.category]
      );
      console.log(`✅ Updated: ${m.region}/${m.category}`);
    } else {
      await pool.query(
        `INSERT INTO emission_factor_mappings 
          (region, country_name, category, activity_id, parameter_name, parameter_unit, data_version, preferred_source, priority, confidence_score, is_active, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,$11)`,
        [m.region, m.country_name, m.category, m.activity_id, m.parameter_name, m.parameter_unit, m.data_version, m.preferred_source, m.priority, m.confidence_score, m.notes]
      );
      console.log(`✅ Inserted: ${m.region}/${m.category}`);
    }
  }

  // Verify
  const check = await pool.query(`
    SELECT region, category, activity_id, parameter_name, parameter_unit, preferred_source
    FROM emission_factor_mappings
    WHERE region='US' AND category IN ('freight','railway','flight') AND preferred_source='Climatiq'
    ORDER BY category
  `);
  console.log("\n=== Final US Climatiq Mappings ===");
  console.table(check.rows);

  await pool.end();
}

run().catch(console.error);
