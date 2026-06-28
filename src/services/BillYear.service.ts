export function extractYearFromInvoice(invoice: any): number | null {
  const possibleDate =
    invoice.invoiceDate ||
    invoice.issueDate ||
    invoice.date ||
    invoice.rawResponse?.data?.issueDate?.parsed ||
    invoice.rawResponse?.data?.issueDate?.raw ||
    null;

  if (possibleDate) {
    const yearMatch = String(possibleDate).match(/\b(20\d{2}|19\d{2})\b/);
    if (yearMatch) return Number(yearMatch[1]);
  }

  const rawText =
    invoice.rawResponse?.data?.rawText ||
    invoice.rawResponse?.rawText ||
    "";

  const rawYearMatch = String(rawText).match(/\b(20\d{2}|19\d{2})\b/);
  if (rawYearMatch) return Number(rawYearMatch[1]);

  return null;
}
