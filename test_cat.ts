import { detectCategoryFromText } from './src/services/CategoryDetection.service.js';

const tests = [
  'Sheets Aluminium',
  '1100 Volts XLPE Insulated Armoured Aluminium Conductor HT Cable AVOCAB',
  'Aluminum Laps 70spm',
  'Electronic Choke 36w days',
  'Caustic Soda',
];

for (const t of tests) {
  console.log(`${detectCategoryFromText(t).padEnd(15)} <-- ${t.substring(0,50)}`);
}
process.exit(0);
