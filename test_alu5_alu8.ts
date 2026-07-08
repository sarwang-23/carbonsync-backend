import { pool } from './src/db.js';
import { processInvoiceEmissions } from './src/services/InvoiceEmission.service.js';

async function run() {
    try {
        console.log('=== Test: aluminium 5 (Sheets Aluminium) ===');
        const r1 = await processInvoiceEmissions({
            region: 'IN',
            country_name: 'India',
            items: [
                { item_name: 'Sheets Aluminium', category: 'steel_sheet', value: 1, unit: 'MT' },
            ],
        } as any);
        for (const r of r1.results) {
            const icon = r.status === 'calculated' ? '✅' : '❌';
            console.log(`${icon} [${r.category}] ${r.item_name} → ${r.status} | co2e=${r.co2e ?? 'N/A'} | ${r.reason ?? r.activity_id}`);
        }

        console.log('\n=== Test: aluminium 8 (AVOCAB Cable in Mtrs) ===');
        const r2 = await processInvoiceEmissions({
            region: 'IN',
            country_name: 'India',
            items: [
                { item_name: "1100 Volts Grade XLPE Insulated Armoured Aluminium Conductor HT Cable of AVOCAB Brand", category: 'aluminium', value: 503, unit: 'Mtrs' },
            ],
        } as any);
        for (const r of r2.results) {
            const icon = r.status === 'calculated' ? '✅' : '❌';
            console.log(`${icon} [${r.category}] ${r.item_name.substring(0,50)}... → ${r.status} | co2e=${r.co2e ?? 'N/A'} | ${r.reason ?? r.activity_id}`);
        }

    } catch (e) {
        console.error('Fatal:', e);
    }
    await pool.end();
    process.exit(0);
}
run();
