const fs = require('fs');
const PizZip = require('pizzip');
const path = require('path');

const TEMPLATE_PATH = path.join(process.cwd(), 'src/services/reports/uk/template.docx');
const content = fs.readFileSync(TEMPLATE_PATH, 'binary');
const zip = new PizZip(content);
let xml = zip.file('word/document.xml').asText();

// 1. Replace Company Name
xml = xml.replace(
  />CarbonSynq Earth Demo Client</g, 
  '>{{company_name}}<'
);
// In case it's split up:
xml = xml.replace(
  />CarbonSynq<\/w:t>.*?<w:t[^>]*> Earth Demo Client</g, 
  '>{{company_name}}<'
);

// 2. Replace Date
xml = xml.replace(
  />10 July 2026</g, 
  '>{{invoice_date}}<'
);

// 3. Replace SCOPE 1, 2, 3 and TOTAL values
// Using regex to find the numbers right after the SCOPE headers
xml = xml.replace(
  /(>SCOPE 1<\/w:t>.*?<w:t[^>]*>)0\.0000(<\/w:t>)/g,
  '$1{{scope1}}$2'
);
xml = xml.replace(
  /(>SCOPE 2<\/w:t>.*?<w:t[^>]*>)0\.1999(<\/w:t>)/g,
  '$1{{scope2}}$2'
);
xml = xml.replace(
  /(>SCOPE 3<\/w:t>.*?<w:t[^>]*>)0\.0000(<\/w:t>)/g,
  '$1{{scope3}}$2'
);
xml = xml.replace(
  /(>TOTAL<\/w:t>.*?<w:t[^>]*>)0\.1999(<\/w:t>)/g,
  '$1{{total_emissions}}$2'
);

zip.file('word/document.xml', xml);
const newBuf = zip.generate({ type: 'nodebuffer' });
fs.writeFileSync(TEMPLATE_PATH, newBuf);
console.log('Template XML successfully patched and saved!');
