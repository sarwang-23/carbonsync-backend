import 'dotenv/config';
import axios from 'axios';

async function run() {
    const queries = ['hardwood', 'wood products'];
    for (const q of queries) {
        const res = await axios.get(`https://api.climatiq.io/data/v1/search?query=${encodeURIComponent(q)}&data_version=^6&results_per_page=20`, {
            headers: { Authorization: `Bearer ${process.env.CLIMATIQ_API_KEY}` }
        });
        console.log(`\n--- ${q.toUpperCase()} ---`);
        console.log([...new Set(res.data.results.map((r: any) => r.activity_id))].slice(0, 10));
    }
    process.exit(0);
}
run();
