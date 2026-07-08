import { pool } from './src/db.ts';
import { calculateIndiaClimatiqFallback } from './src/services/IndiaClimatiqFallback.service.ts';

async function run() {
  try {
    // TIMBER 6: 1800 Sq.Mtr. Safety Net → plastic (Spend 2,52,000 INR)
    console.log('\n--- TIMBER 6: Safety Net, 1800 Sq.Mtr., plastic ---');
    const ef6 = await calculateIndiaClimatiqFallback({
      category: 'plastic',
      itemName: 'Safety Net',
      value: 1800,
      unit: 'Sq.Mtr.',
      amount: 252000,
      currency: 'inr'
    });
    console.log(`status  : ${ef6.status}`);
    console.log(`co2e    : ${ef6.co2e} ${ef6.co2e_unit}`);
    console.log(`factor  : ${ef6.factor_name}`);
    console.log(`note    : ${(ef6 as any).converted?.conversion_note ?? ''}`);

    // TIMBER 4: 2000 Sq.Mtr. Safety Net → plastic (Spend 2,80,000 INR)
    console.log('\n--- TIMBER 4: Safety Net, 2000 Sq.Mtr., plastic ---');
    const ef4 = await calculateIndiaClimatiqFallback({
      category: 'plastic',
      itemName: 'Safety Net',
      value: 2000,
      unit: 'Sq.Mtr.',
      amount: 280000,
      currency: 'inr'
    });
    console.log(`status  : ${ef4.status}`);
    console.log(`co2e    : ${ef4.co2e} ${ef4.co2e_unit}`);
    console.log(`factor  : ${ef4.factor_name}`);
    console.log(`note    : ${(ef4 as any).converted?.conversion_note ?? ''}`);
  } catch(e: any) {
    console.error('Error:', e?.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}
run();
