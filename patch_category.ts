import { readFileSync, writeFileSync } from 'fs';

const file = 'src/services/CategoryDetection.service.ts';
let content = readFileSync(file, 'utf8');

// ---- Fix 1: Guard aluminium/aluminum sheets before generic sheet → steel_sheet ----
const TARGET1 = `  if (
    lower.includes("sheet") ||
    lower.includes("steel sheet") ||
    lower.includes("cr sheet") ||
    lower.includes("hr sheet") ||
    lower.includes("gi sheet") ||
    lower.includes("gp sheet")
  ) {
    return "steel_sheet";
  }`;

const REPLACEMENT1 = `  // Guard: aluminium/aluminum sheets must NOT match steel_sheet
  if (
    (lower.includes("aluminium") || lower.includes("aluminum")) &&
    lower.includes("sheet")
  ) {
    return "aluminium";
  }

  if (
    lower.includes("sheet") ||
    lower.includes("steel sheet") ||
    lower.includes("cr sheet") ||
    lower.includes("hr sheet") ||
    lower.includes("gi sheet") ||
    lower.includes("gp sheet")
  ) {
    return "steel_sheet";
  }`;

// ---- Fix 2: Aluminium cables/conductors → electrical ----
const TARGET2 = `  if (
    lower.includes("aluminium") ||
    lower.includes("aluminum") ||
    lower.includes("aluminium sheet") ||
    lower.includes("aluminium bar") ||
    lower.includes("aluminium profile") ||
    lower.includes("aluminium extrusion") ||
    lower.includes("aluminium ingot") ||
    lower.includes("aluminium billet")
  ) {
    return "aluminium";
  }`;

const REPLACEMENT2 = `  // Aluminium cables & conductors → electrical (not raw aluminium metal)
  if (
    (lower.includes("aluminium") || lower.includes("aluminum")) &&
    (
      lower.includes("cable") ||
      lower.includes("conductor") ||
      lower.includes("ht cable") ||
      lower.includes("lt cable") ||
      lower.includes("armoured cable") ||
      lower.includes("xlpe") ||
      lower.includes("pvc insulated") ||
      lower.includes("avocab") ||
      lower.includes("submersible cable")
    )
  ) {
    return "electrical";
  }

  if (
    lower.includes("aluminium") ||
    lower.includes("aluminum") ||
    lower.includes("aluminium sheet") ||
    lower.includes("aluminium bar") ||
    lower.includes("aluminium profile") ||
    lower.includes("aluminium extrusion") ||
    lower.includes("aluminium ingot") ||
    lower.includes("aluminium billet")
  ) {
    return "aluminium";
  }`;

let changed = false;

if (content.includes(TARGET1)) {
    content = content.replace(TARGET1, REPLACEMENT1);
    console.log('✅ Fix 1 applied: aluminium sheet guard before steel_sheet');
    changed = true;
} else {
    console.error('❌ Fix 1: target not found');
    console.log('Searching snippet:', JSON.stringify(content.substring(content.indexOf('"sheet"') - 10, content.indexOf('"sheet"') + 50)));
}

if (content.includes(TARGET2)) {
    content = content.replace(TARGET2, REPLACEMENT2);
    console.log('✅ Fix 2 applied: aluminium cable guard before aluminium block');
    changed = true;
} else {
    console.error('❌ Fix 2: target not found');
}

if (changed) {
    writeFileSync(file, content, 'utf8');
    console.log('✅ File saved');
}
