import { pool } from './src/db.js';
import { processInvoiceEmissions } from './src/services/InvoiceEmission.service.js';

async function run() {
    try {
        const result = await processInvoiceEmissions({
            region: 'IN',
            country_name: 'India',
            items: [
                { item_name: 'Electronic Choke 36w days', category: 'unknown', value: 100, unit: 'ft' },
                { item_name: 'TBU 400w choke pump', category: 'unknown', value: 50, unit: 'ft' },
                { item_name: 'Aluminum Laps 70spm', category: 'aluminium', value: 200, unit: 'ft' },
                { item_name: 'Lamp 36w days', category: 'electrical', value: 200, unit: 'ft' },
                { item_name: 'Tabernf Dlty 36w with Electronic Choke days', category: 'unknown', value: 200, unit: 'ft' },
                { item_name: 'ChedaI xelle dlty 400w with Choke & lamp pump', category: 'electrical', value: 50, unit: 'ft' },
            ],
        } as any);

        console.log(`\n✅ calculated_count: ${result.calculated_count} / ${result.total_items}`);
        console.log(`❌ review_count: ${result.review_count}`);
        console.log('\n📦 Results:');
        for (const r of result.results) {
            const emoji = r.status === 'calculated' ? '✅' : '❌';
            console.log(`${emoji} [${r.category}] ${r.item_name} → ${r.status} | co2e=${r.co2e ?? 'N/A'} | reason=${r.reason ?? r.activity_id}`);
        }
    } catch (e) {
        console.error('Fatal error:', e);
    }
    await pool.end();
    process.exit(0);
}
run();
