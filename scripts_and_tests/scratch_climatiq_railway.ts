import 'dotenv/config';
import { searchClimatiqEmissionFactors } from './src/services/climatiq.service.js';

async function run() {
  try {
    const res = await searchClimatiqEmissionFactors({
      query: 'passenger_train-route_type_national_rail',
      region: 'GB',
      resultsPerPage: 1
    });
    console.log(JSON.stringify(res.results[0], null, 2));
  } catch (e) {
    console.error(e);
  }
}
run();
