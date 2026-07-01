import 'dotenv/config';
import { searchClimatiqFactor } from './src/services/ClimatiqSearch.service.js';

async function run() {
  console.log("=== Searching: road freight ===");
  const freight = await searchClimatiqFactor({
    query: 'road freight hgv diesel',
    region: 'GB',  // use GB to find global factors
    dataVersion: '^21',
    resultsPerPage: 5,
  });
  console.log("Freight results:", JSON.stringify(freight, null, 2));

  console.log("\n=== Searching: domestic flight ===");
  const flight = await searchClimatiqFactor({
    query: 'passenger flight domestic',
    region: 'GB',
    dataVersion: '^21',
    resultsPerPage: 5,
  });
  console.log("Flight results:", JSON.stringify(flight, null, 2));
}

run().catch(console.error);
