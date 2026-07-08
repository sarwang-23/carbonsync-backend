import { pool } from './src/db.js';
import { normalizeItemName } from './src/services/InvoiceItemNormalize.service.js';
import { detectCategoryFromText } from './src/services/CategoryDetection.service.js';
import { calculateIndiaClimatiqFallback } from './src/services/IndiaClimatiqFallback.service.js';

async function run() {
  // TIMBER 6 raw name
  const raw6 = 'Safety Net Vertical Safety Net Nylone Monofilament Agro Shade Net With Fishing Net of Mesh x Bordering with Rope x';
  const vendor = 'Realtek Enterprises';

  const clean6 = normalizeItemName(raw6, vendor);
  const cat6   = detectCategoryFromText(clean6);
  console.log(`\nTIMBER 6:`);
  console.log(`  raw      : "${raw6.slice(0,60)}..."`);
  console.log(`  cleaned  : "${clean6}"`);
  console.log(`  category : ${cat6}`);

  // TIMBER 4 raw name (was "x" after OCR)
  const raw4 = 'x';
  const clean4 = normalizeItemName(raw4, vendor);
  const cat4   = detectCategoryFromText(clean4);
  console.log(`\nTIMBER 4:`);
  console.log(`  cleaned  : "${clean4}"`);
  console.log(`  category : ${cat4}`);

  // EF for Safety Net (plastic category, Sq.Mtr. unit)
  if (cat6 === 'plastic') {
    console.log(`\n--- Running Climatiq EF for Safety Net (plastic, 1000 Sq.Mtr.) ---`);
    try {
      const ef = await calculateIndiaClimatiqFallback({
        category: 'plastic',
        itemName: clean6,
        value: 1000,
        unit: 'Sq.Mtr.',
      });
      console.log('EF result:', JSON.stringify(ef, null, 2));
    } catch (e) {
      console.error('EF error:', e);
    }
  }

  // EF for Plywood (wood category, Sq.Mtr. unit - TIMBER 4 case)
  if (cat4 === 'wood' || clean4 === 'Plywood') {
    console.log(`\n--- Running Climatiq EF for Plywood (wood, 2000 Sq.Mtr.) ---`);
    try {
      const ef = await calculateIndiaClimatiqFallback({
        category: 'wood',
        itemName: clean4,
        value: 2000,
        unit: 'Sq.Mtr.',
      });
      console.log('EF result:', JSON.stringify({
        co2e: ef.co2e,
        unit: ef.co2e_unit,
        factor: ef.factor_name,
        status: ef.status,
      }, null, 2));
    } catch (e: any) {
      console.error('EF error:', e?.message);
    }
  }

  await pool.end();
  process.exit(0);
}
run();
