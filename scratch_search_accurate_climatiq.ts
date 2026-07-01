import 'dotenv/config';
import axios from 'axios';

async function search() {
  const queries = [
    { name: 'lpg', q: 'liquefied petroleum gas stationary EPA' },
    { name: 'flight', q: 'passenger flight domestic UK' }
  ];

  for (const item of queries) {
    console.log(`\n=== Searching for ${item.name} (${item.q}) ===`);
    try {
      const res = await axios.get('https://api.climatiq.io/data/v1/search', {
        headers: { Authorization: `Bearer ${process.env.CLIMATIQ_API_KEY}` },
        params: {
          query: item.q,
          data_version: '^6',
          results_per_page: 5
        }
      });
      
      const results = res.data.results;
      if (results.length > 0) {
        for (let i = 0; i < Math.min(2, results.length); i++) {
          const r = results[i];
          console.log(` - ID: ${r.activity_id}`);
          console.log(`   Name: ${r.name}`);
          console.log(`   Source: ${r.source} (${r.region})`);
          console.log(`   Unit Type: ${r.unit_type}`);
          console.log(`   Desc: ${r.description.slice(0, 80)}...`);
        }
      } else {
        console.log("No results.");
      }
    } catch (e: any) {
      console.log(`Error: ${e.message}`);
    }
  }
}

search().then(() => process.exit(0)).catch(console.error);
