import { pool } from './src/db.js';
import { calculateIndiaClimatiqFallback } from './src/services/IndiaClimatiqFallback.service.js';

async function run() {
    try {
        console.log('Testing Aluminium Scrap...');
        const r2 = await calculateIndiaClimatiqFallback({ category: 'aluminium', itemName: 'Aluminium Scrap', value: 1, unit: 'MT' });
        console.log(JSON.stringify(r2, null, 2));
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await pool.end();
        process.exit(0);
    }
}
run();
