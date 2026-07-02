// Quick diagnostic: simulate what the railway parser receives from fullText
const fullText = [
  "Indian Railways Test Vendor India",
  "IN-RAIL-001",
  "INR",
  JSON.stringify([{ item_name: "Railway travel", quantity: 1, unit: "ticket", amount: 2500, currency: "INR" }]),
].filter(Boolean).join(" ");

// Try to match what we look for
const tests = [
  { name: "IRCTC", re: /irctc/i },
  { name: "Indian Railways", re: /indian\s*railways/i },
  { name: "PNR", re: /pnr/i },
  { name: "Train No", re: /train\s+no/i },
  { name: "Reservation Slip", re: /electronic\s+reservation\s+slip/i },
  { name: "Distance kms", re: /distance\s*[:\-]?\s*[\d,.]+\s*kms?\b/i },
  { name: "From-To city", re: /\bfrom\s*[:\-]?\s*[A-Za-z\s]+?\s+to\s*[:\-]?\s*[A-Za-z\s]+/i },
  { name: "City to city", re: /\b(delhi|mumbai|chennai|kolkata|bangalore|bengaluru|hyderabad|pune)\s+to\s+(delhi|mumbai|chennai|kolkata|bangalore|bengaluru|hyderabad|pune)\b/i },
];

console.log("\n=== Railway Parse Debug ===");
console.log("Text preview:", fullText.slice(0, 200));
for (const t of tests) {
  console.log(`  [${t.re.test(fullText) ? "✓" : "✗"}] ${t.name}`);
}
