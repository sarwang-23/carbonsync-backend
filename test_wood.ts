import "dotenv/config";
import { processInvoiceEmissions } from './src/services/InvoiceEmission.service';
import { detectCategoryFromText } from './src/services/CategoryDetection.service';

async function run() {
    try {
        console.log('=== Test: Category Detection ===');
        const testItems = ['Door Shutter', 'Plywood 18mm', 'Pine Wood Logs', 'Wooden Furniture', 'Bamboo Boards'];
        for (const item of testItems) {
            console.log(`${item.padEnd(20)} -> ${detectCategoryFromText(item)}`);
        }

        console.log('\n=== Test: Emission Pipeline for Timber Items ===');
        const res = await processInvoiceEmissions({
            region: 'IN',
            country_name: 'India',
            items: [
                { item_name: 'Door Shutter', category: 'unknown', value: 10, unit: 'pcs' },
                { item_name: 'Plywood 18mm', category: 'unknown', value: 50, unit: 'kg' }
            ],
        } as any);

        for (const r of res.results) {
            const icon = r.status === 'calculated' ? '✅' : '❌';
            console.log(`${icon} [${r.category}] ${r.item_name} -> ${r.status} | co2e=${r.co2e ?? 'N/A'} | ${r.reason ?? r.activity_id}`);
        }
    } catch (e) {
        console.error('Fatal:', e);
    }
    process.exit(0);
}
run();
