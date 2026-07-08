import { config } from 'dotenv';
config();
async function run() {
  const apiKey = process.env.CLIMATIQ_API_KEY;
  const res = await fetch('https://api.climatiq.io/data/v1/search?query=plastic&results_per_page=1&region=IN&data_version=%5E6', {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const data = await res.json();
  console.log(JSON.stringify(data.results.map((r: any) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    unit_type: r.unit_type,
    region: r.region,
    parameters: r.parameters
  })), null, 2));
}
run();
