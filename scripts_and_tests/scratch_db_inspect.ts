import 'dotenv/config';
import { pool } from './src/db.js';

async function main() {
  const client = await pool.connect();
  try {
    // Check column names in uploaded_invoices
    const cols1 = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'uploaded_invoices' ORDER BY ordinal_position
    `);
    console.log('\n=== uploaded_invoices columns ===');
    console.table(cols1.rows);

    const cols2 = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'emission_calculation_inputs' ORDER BY ordinal_position
    `);
    console.log('\n=== emission_calculation_inputs columns ===');
    console.table(cols2.rows);

    const cols3 = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'emission_calculation_outputs' ORDER BY ordinal_position
    `);
    console.log('\n=== emission_calculation_outputs columns ===');
    console.table(cols3.rows);

    // Get latest uploaded invoices with their emission output status
    const latest = await client.query(`
      SELECT 
        ui.id, ui.file_name, ui.upload_source, ui.status, ui.created_at,
        eci.id as input_id, eci.item_name, eci.category, eci.quantity, eci.unit,
        eco.success, eco.co2e, eco.error_code, eco.error_message
      FROM uploaded_invoices ui
      LEFT JOIN emission_calculation_inputs eci ON eci.invoice_id = ui.id
      LEFT JOIN emission_calculation_outputs eco ON eco.input_id = eci.id
      ORDER BY ui.created_at DESC
      LIMIT 10
    `);
    console.log('\n=== joined invoice+emission status (latest 10) ===');
    console.table(latest.rows);

  } catch (err: any) {
    console.error('Query error:', err.message);
    // Try alternate join key
    const altJoin = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'emission_calculation_inputs'
    `);
    console.log('emission_calculation_inputs columns:', altJoin.rows.map((r:any) => r.column_name));
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
