import { pool } from './src/db.js';
import { processInvoiceEmissions } from './src/services/InvoiceEmission.service.js';

async function run() {
    console.log('starting test');
    try {
        console.log('calling processInvoiceEmissions');
        const result = await processInvoiceEmissions({
            region: 'IN',
            country_name: 'India',
            items: [
                { item_name: 'Caustic', category: 'unknown', value: 2, unit: 'MT' },
                { item_name: 'Aluminium Scrap', category: 'aluminium', value: 1, unit: 'MT' }
            ],
        } as any);
        
        console.log(JSON.stringify(result, null, 2));
    } catch(e) {
        console.error('fatal error', e);
    }
    console.log('ending test');
    await pool.end();
    process.exit(0);
}
run();
