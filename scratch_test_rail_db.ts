import { smartRailLookup } from "./src/services/IndiaRailwayRouteDB.js";

const result1 = smartRailLookup("DLI", "MFP");
const result2 = smartRailLookup("NDLS", "MFP");
const result3 = smartRailLookup("NDLS", "BCT");

console.log("DLI-MFP:", result1);
console.log("NDLS-MFP:", result2);
console.log("NDLS-BCT:", result3);
