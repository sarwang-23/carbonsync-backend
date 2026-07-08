import 'dotenv/config';

async function search() {
  const apiKey = process.env.CLIMATIQ_API_KEY;
  const queries = [
    { cat: 'electricity', query: 'electricity production mix' },
  ];

  for (const q of queries) {
    const res = await fetch(`https://api.climatiq.io/search?query=${encodeURIComponent(q.query)}&region=DE&source=UBA&data_version=^6`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await res.json();
    console.log(`\n--- ${q.cat} ---`);
    if (data.results) {
      for (const r of data.results.slice(0, 5)) {
        console.log(`ID: ${r.activity_id} | Year: ${r.year} | Source: ${r.source}`);
      }
    } else {
      console.log('No results found.', data);
    }
  }
}

search();
