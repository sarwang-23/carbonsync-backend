/**
 * patch_template.cjs — XML-run-aware patching
 * 
 * Word splits text across multiple <w:r><w:t> runs.
 * "CarbonSynq Earth Demo Client" might appear as:
 *   <w:t>CarbonSynq </w:t>...<w:t>Earth</w:t>...<w:t>Demo Client</w:t>
 *
 * We use a smarter approach:
 * 1. Strip all XML tags to find plain text
 * 2. Then replace in the raw XML with a regex that skips tags between chars
 */

const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "src", "services", "reports", "uk", "template.docx"
);

const BACKUP_PATH = TEMPLATE_PATH.replace("template.docx", "template.bak.docx");

// Each entry: [ plainTextToFind, replacementPlaceholder ]
// The script will build a run-skipping regex for each one
const REPLACEMENTS = [
  ["CarbonSynq Earth Demo Client", "{{COMPANY_NAME}}"],
  ["10 July 2026",                 "{{REPORT_DATE}}"],
];

/**
 * Build a regex that matches the given text across XML tag boundaries.
 * E.g. "Hello World" becomes: H[^<]*(?:<[^>]+>[^<]*)*e[^<]*(?:<[^>]+>[^<]*)*l...
 * (simplified: we match each character allowing any XML between them)
 */
function buildRunAwareRegex(text) {
  const XML_BETWEEN = "(?:<[^>]+>\\s*)*"; // zero or more XML tags between chars
  const escaped = text
    .split("")
    .map(c => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(XML_BETWEEN);
  return new RegExp(escaped, "g");
}

/**
 * Given a match span in the XML, we need to:
 * 1. Keep all XML structure
 * 2. Replace the TEXT CONTENT with the placeholder (in the first run only)
 * 3. Remove text content from subsequent runs that made up the matched text
 *
 * Simpler approach: inject placeholder directly into first <w:t>, blank out rest.
 */
function replaceInXml(xml, text, placeholder) {
  const regex = buildRunAwareRegex(text);
  let replaced = false;
  
  const result = xml.replace(regex, (match) => {
    if (replaced) return match; // only replace first occurrence for safety
    replaced = true;
    
    // Replace first <w:t>...</w:t> content with placeholder, blank rest
    let firstDone = false;
    return match.replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, (tagMatch, textContent) => {
      if (!firstDone && textContent.trim().length > 0) {
        firstDone = true;
        return tagMatch.replace(textContent, placeholder);
      }
      if (firstDone && textContent.trim().length > 0) {
        return tagMatch.replace(textContent, "");
      }
      return tagMatch;
    });
  });
  
  if (replaced) {
    console.log(`✅ Replaced "${text}" → "${placeholder}"`);
  } else {
    console.warn(`⚠️  Not found (even with run-aware regex): "${text}"`);
  }
  return result;
}

function patchDocx() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.error("❌ template.docx not found at:", TEMPLATE_PATH);
    process.exit(1);
  }

  // Backup original
  if (!fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(TEMPLATE_PATH, BACKUP_PATH);
    console.log("📦 Backup saved to:", BACKUP_PATH);
  }

  const content = fs.readFileSync(TEMPLATE_PATH, "binary");
  const zip = new PizZip(content);
  let xml = zip.file("word/document.xml").asText();

  for (const [from, to] of REPLACEMENTS) {
    xml = replaceInXml(xml, from, to);
  }

  zip.file("word/document.xml", xml);
  const patched = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(TEMPLATE_PATH, patched);
  console.log("\n✅ Template patched and saved!");
}

patchDocx();
