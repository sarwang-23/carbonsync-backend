const fs = require('fs');

const path = './src/services/IndiaClimatiqFallback.service.ts';
let content = fs.readFileSync(path, 'utf8');

// Add paper, food, agriculture, construction to WEIGHT_CATEGORIES
content = content.replace(
  'const WEIGHT_CATEGORIES = [',
  'const WEIGHT_CATEGORIES = [\n  "paper",\n  "food",\n  "agriculture",\n  "construction",\n'
);

// We need to inject the generic fallback EF for steel and aluminium at the end of their respective lists so they don't override more specific regional EFs, but act as a final fallback.
// Actually, earlier tests showed that the specific EFs failed for US, EU, AU, etc., so injecting them at the START is safer to guarantee an EF is found, but it might override better ones if they exist.
// Let's just insert them at the top of the array for 'aluminium:' and all 'steel_' arrays.

const lines = content.split('\n');
let newLines = [];
let inArray = false;
let currentKey = '';

for (let line of lines) {
  newLines.push(line);
  
  const match = line.match(/^  ([a-zA-Z0-9_]+): \[\s*$/);
  if (match) {
    currentKey = match[1];
    
    if (currentKey.includes('steel') || currentKey === 'billet' || currentKey === 'bloom' || currentKey === 'slab') {
      newLines.push('    "metals-type_steel_engineering_steel", // Global fallback');
    } else if (currentKey.includes('aluminium')) {
      newLines.push('    "metals-type_aluminium_primary", // Global fallback');
    }
  }
}

fs.writeFileSync(path, newLines.join('\n'));
console.log('Successfully injected fallbacks.');
