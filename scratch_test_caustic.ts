import { pool } from './src/db.js';
import { calculateIndiaClimatiqFallback } from './src/services/IndiaClimatiqFallback.service.js';

async function run() {
    try {
        console.log('Testing Caustic...');
        const r1 = await calculateIndiaClimatiqFallback({ category: 'chemicals', itemName: 'Caustic', value: 2, unit: 'MT' });
        console.log(JSON.stringify(r1, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
    }
}
run();
