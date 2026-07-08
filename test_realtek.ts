import { normalizeItemName } from './src/services/InvoiceItemNormalize.service.ts';
import { detectCategoryFromText } from './src/services/CategoryDetection.service.ts';

const vendor = 'Realtek Enterprises';

// TIMBER 6
const raw6 = 'Safety Net Vertical Safety Net Nylone Monofilament Agro Shade Net With Fishing Net of Mesh x Bordering with Rope x';
const c6 = normalizeItemName(raw6, vendor);
console.log('TIMBER 6 name   :', c6);
console.log('TIMBER 6 category:', detectCategoryFromText(c6));

// TIMBER 4 (was gibberish 'x' after OCR)
const raw4 = 'x';
const c4 = normalizeItemName(raw4, vendor);
console.log('\nTIMBER 4 name   :', c4);
console.log('TIMBER 4 category:', detectCategoryFromText(c4));
