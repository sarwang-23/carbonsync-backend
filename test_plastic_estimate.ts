import { config } from 'dotenv';
config();
async function run() {
  const apiKey = process.env.CLIMATIQ_API_KEY;
  const res = await fetch('https://api.climatiq.io/data/v1/estimate', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      emission_factor: {
        activity_id: 'materials-type_plastics_general',
        data_version: '^6',
        region: 'IN'
      },
      parameters: {
        money: 252000,
        money_unit: 'inr'
      }
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
