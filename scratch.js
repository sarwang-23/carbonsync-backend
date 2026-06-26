import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'src', 'services', 'dynamicEmissionFactor.service.ts');
const content = fs.readFileSync(filePath, 'utf-8');

const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.startsWith('+++ /mnt/data/backend_inspect/carbonsync-backend-main/src/services/dynamicEmissionFactor.service.ts'));

if (startIdx === -1) {
  console.log("Could not find start index");
  process.exit(1);
}

const serviceLines = [];
for (let i = startIdx + 2; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith('+')) {
    serviceLines.push(line.substring(1));
  } else if (line.trim() === '') {
    serviceLines.push('');
  }
}

fs.writeFileSync(filePath, serviceLines.join('\n'));
console.log("File written successfully!");
