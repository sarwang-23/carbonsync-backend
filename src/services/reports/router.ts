import { generateReport as generateINReport } from "./india/generator.js";
import { generateReport as generateUKReport } from "./uk/generator.js";
import { generateReport as generateAUReport } from "./australia/generator.js";
import { generateReport as generateDEReport } from "./germany/generator.js";
import { generateReport as generateFRReport } from "./france/generator.js";
import { generateReport as generateMYReport } from "./malaysia/generator.js";
import { generateReport as generateUSReport } from "./usa/generator.js";


export function generateLocalReportHtml(region: string, commonData: any): string {
  const normalizedRegion = (region || "IN").toUpperCase();

  switch (normalizedRegion) {
    case "IN":
      return generateINReport(commonData);
    case "GB":
    case "UK":
      return generateUKReport(commonData);
    case "AU":
      return generateAUReport(commonData);
    case "DE":
      return generateDEReport(commonData);
    case "FR":
      return generateFRReport(commonData);
    case "MY":
      return generateMYReport(commonData);
    case "US":
      return generateUSReport(commonData);

    default:
      return generateINReport(commonData);
  }
}
