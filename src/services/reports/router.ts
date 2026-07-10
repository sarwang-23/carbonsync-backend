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
    case 'GB':
    case 'UK': 
      return await generateUKReport(commonData);
    
    // For now, all other countries default to India's BRSR HTML report
    // until their specific templates are ready.
    case 'IN':
    case 'AU': 
    case 'DE': 
    case 'FR': 
    case 'MY': 
    case 'US': 
    default: 
      return { html: generateINReport(commonData) };
  }
}
