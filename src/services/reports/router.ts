import { generateReport as generateINReport } from './india/generator.js';
import { generateReport as generateUKReport } from './uk/generator.js';
import { generateReport as generateAUReport } from './australia/generator.js';
import { generateReport as generateDEReport } from './germany/generator.js';
import { generateReport as generateFRReport } from './france/generator.js';
import { generateReport as generateUSReport } from './usa/generator.js';
import { generateReport as generateMYReport } from './malaysia/generator.js';

export async function generateLocalReport(region: string, commonData: any): Promise<any> {
  const normalizedRegion = (region || 'IN').toUpperCase();

  switch (normalizedRegion) {
    case 'IN': return { html: generateINReport(commonData) };
    case 'GB':
    case 'UK': return await generateUKReport(commonData);
    case 'AU': return await generateAUReport(commonData);
    case 'DE': return await generateDEReport(commonData);
    case 'FR': return await generateFRReport(commonData);
    case 'MY': return await generateMYReport(commonData);
    case 'US': return await generateUSReport(commonData);
    default: return { html: generateINReport(commonData) };
  }
}
