import 'dotenv/config';
import { searchClimatiqFactor } from './src/services/ClimatiqSearch.service.js';
import axios from 'axios';

async function run() {
    const res = await axios.get('https://api.climatiq.io/data/v1/search?query=steel+sheet&data_version=^6&results_per_page=50', {
        headers: { Authorization: `Bearer ${process.env.CLIMATIQ_API_KEY}` }
    });
    console.log("STEEL SHEET:");
    console.log(res.data.results.map((r: any) => r.activity_id));

    const res2 = await axios.get('https://api.climatiq.io/data/v1/search?query=steel+plate&data_version=^6&results_per_page=50', {
        headers: { Authorization: `Bearer ${process.env.CLIMATIQ_API_KEY}` }
    });
    console.log("STEEL PLATE:");
    console.log(res2.data.results.map((r: any) => r.activity_id));
    
    const res3 = await axios.get('https://api.climatiq.io/data/v1/search?query=steel+coil&data_version=^6&results_per_page=50', {
        headers: { Authorization: `Bearer ${process.env.CLIMATIQ_API_KEY}` }
    });
    console.log("STEEL COIL:");
    console.log(res3.data.results.map((r: any) => r.activity_id));

    process.exit(0);
}
run();
