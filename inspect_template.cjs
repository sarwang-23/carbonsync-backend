/**
 * inspect_template_xml.cjs
 * Dumps first 3000 chars of the document.xml from template.docx
 * so we can find the exact strings to replace.
 */
const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "src", "services", "reports", "uk", "template.docx"
);

const content = fs.readFileSync(TEMPLATE_PATH, "binary");
const zip = new PizZip(content);
const xml = zip.file("word/document.xml").asText();

// Find text that looks like a company name or date
const snippets = [];
const patterns = [
  /CarbonSyn[qc][^<]{0,50}/gi,
  /Demo Client[^<]{0,50}/gi,
  /Prepared for[^<]{0,80}/gi,
  /10 Jul[^<]{0,30}/gi,
  /July 2026[^<]{0,30}/gi,
  /2026[^<]{0,30}/gi,
  /Client Name[^<]{0,30}/gi,
];

patterns.forEach(p => {
  const matches = xml.match(p) || [];
  if (matches.length) snippets.push(...matches);
});

console.log("\n=== Matching text found in document.xml ===\n");
[...new Set(snippets)].forEach(s => console.log(" »", s.replace(/\s+/g, " ").trim()));
console.log("\n=== First 4000 chars of XML ===\n");
console.log(xml.substring(0, 4000));
