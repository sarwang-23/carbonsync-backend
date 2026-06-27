/**
 * Calculation fallback helper.
 * Use this when exact physical Climatiq mapping fails for purchased goods.
 */

export function getSpendUsdAmount(item: any) {
  const amount = Number(item?.amount || 0);
  const currency = String(item?.currency || "").toUpperCase();

  const rates: Record<string, number> = {
    INR: Number(process.env.INR_TO_USD_RATE || 0.012),
    MYR: Number(process.env.MYR_TO_USD_RATE || 0.21),
    USD: 1,
  };

  const rate = rates[currency] || 0;

  if (!amount || !rate) {
    return null;
  }

  return {
    original_amount: amount,
    original_currency: currency,
    value: Number((amount * rate).toFixed(2)),
    unit: "USD",
  };
}

export function shouldUseSpendFallback(item: any, classification: any) {
  const category =
    classification?.category ||
    item?.parameters?.category ||
    item?.category ||
    "";

  const amount = Number(item?.amount || 0);
  const currency = String(item?.currency || "").toUpperCase();

  return category === "purchased_goods" && amount > 0 && !!currency;
}

export function getFallbackSearchTerms(item: any) {
  const name = String(item?.item_name || "").toLowerCase();
  const material = String(item?.parameters?.material || "").toLowerCase();

  if (/safety|net|shade|garware|polypropylene|nylone|monofilament/.test(name + " " + material)) {
    return {
      material: "plastic product",
      query: "plastic products purchased goods spend",
      calculation_basis: "spend_based",
    };
  }

  if (/timber|wood|plywood|door|shutter|flush/.test(name + " " + material)) {
    return {
      material: "wood product",
      query: "wood products purchased goods spend",
      calculation_basis: "spend_based",
    };
  }

  if (/steel|iron|tmt/.test(name + " " + material)) {
    return {
      material: "steel product",
      query: "steel products purchased goods spend",
      calculation_basis: "spend_based",
    };
  }

  return {
    material: "purchased goods",
    query: "purchased goods spend",
    calculation_basis: "spend_based",
  };
}