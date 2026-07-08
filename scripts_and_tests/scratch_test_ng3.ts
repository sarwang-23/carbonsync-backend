import 'dotenv/config';
import { searchClimatiqFactor } from './src/services/ClimatiqSearch.service.js';
import { estimateWithClimatiq } from './src/services/climatiq.service.js';

async function search() {
  const res1 = await searchClimatiqFactor({ query: "natural gas", resultsPerPage: 20 });
  const possible = res1?.results?.filter((r: any) => 
    r.sector === 'Energy' && 
    r.category === 'Fuel' && 
    !r.name.toLowerCase().includes('flaring')
  ) || [];
  
  if (possible.length > 0) {
    const act = possible[0].activity_id;
    console.log(`Found activity: ${act} (${possible[0].name})`);
    
    // Test it!
    try {
      const estimate = await estimateWithClimatiq({
        selectedEF: { activity_id: act },
        parameters: { energy: 1500, energy_unit: 'kWh' }
      });
      console.log("Success with energy!");
      console.log(estimate.data);
    } catch (e: any) {
      console.log("Failed with energy:", e.response?.data?.error_code);
    }
  } else {
    console.log("No valid factors found.");
  }
}

search().then(() => process.exit(0)).catch(console.error);
