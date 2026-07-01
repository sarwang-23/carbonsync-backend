import 'dotenv/config';
import { searchClimatiqFactor } from './src/services/ClimatiqSearch.service.js';

async function search() {
  console.log("Searching for natural gas...");
  const res1 = await searchClimatiqFactor({ query: "natural gas", resultsPerPage: 5 });
  console.log(res1);

  console.log("\nSearching for petrol...");
  const res2 = await searchClimatiqFactor({ query: "petrol", resultsPerPage: 5 });
  console.log(res2);
}

search().then(() => process.exit(0)).catch(console.error);
