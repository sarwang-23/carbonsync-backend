import { classifyInvoiceDocument } from "./documentClassifier.service.js";

function safeLower(value: any) {
    return String(value || "").toLowerCase();
}

function toNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    const cleaned = String(value)
        .replace(/,/g, "")
        .replace(/[^\d.\-]/g, "");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
}

function validPositive(value: any) {
    const num = toNumber(value);
    return Number.isFinite(num) && num > 0;
}

function pickBestKwhCandidate(candidates: number[]) {
    const filtered = candidates
        .filter((value) => Number.isFinite(value) && value > 0 && value < 1000000)
        // Avoid selecting small tariff block rows like 1-200 kWh when a total exists.
        .sort((a, b) => b - a);

    return filtered[0] || 0;
}

/**
 * Robust electricity kWh resolver.
 * Important: for TNB bills, tariff rows can contain 200 and 1969,
 * while the final total is 2169. This resolver prioritizes totals and
 * meter-difference rows over the first tariff block.
 */
export function resolveElectricityKwhFromText(rawText: string): number {
    const original = String(rawText || "");
    const clean = original.replace(/,/g, "").replace(/\s+/g, " ");
    const candidates: number[] = [];

    function add(value: any) {
        const num = toNumber(value);
        if (num > 0 && num < 1000000) candidates.push(num);
    }

    const totalPriorityPatterns = [
        /jumlah\s+penggunaan\s+anda\s*\(?\s*([\d,]+(?:\.\d+)?)\s*kwh/i,
        /jumlah\s+penggunaan\s*\(?\s*([\d,]+(?:\.\d+)?)\s*kwh/i,
        /penggunaan\s+anda\s*\(?\s*([\d,]+(?:\.\d+)?)\s*kwh/i,

        // Mistral Markdown / table forms:
        /\|\s*Jumlah\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|/i,
        /\|\s*\*\*Jumlah\*\*\s*\|\s*\*\*?([\d,]+(?:\.\d+)?)\*\*?/i,
        /Kegunaan\s*kWh\s*\|\s*kWh\s*\|\s*[\d,]+(?:\.\d+)?\s*\|\s*[\d,]+(?:\.\d+)?\s*\|\s*([\d,]+(?:\.\d+)?)/i,
        /Jumlah\s+([\d,]+(?:\.\d+)?)\s+(?:kWh|KWH)/i,
    ];

    for (const pattern of totalPriorityPatterns) {
        const match = original.match(pattern) || clean.match(pattern);
        if (match?.[1]) add(match[1]);
    }

    // Meter row examples:
    // 190,730.00 192,899.00 2,169.00 kWh
    // | D002112930 | 190,730.00 | 192,899.00 | 2,169.00 | kWh |
    const meterRowPatterns = [
        /\|\s*[A-Z0-9\-]{4,}\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|\s*kWh/i,
        /(?:Dahulu|Previous)\s*\|?\s*(?:Semasa|Current)[\s\S]{0,250}?([\d,]+(?:\.\d+)?)\s*\|?\s*([\d,]+(?:\.\d+)?)\s*\|?\s*([\d,]+(?:\.\d+)?)\s*kWh/i,
        /([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)\s+kWh/i,
    ];

    for (const pattern of meterRowPatterns) {
        const match = original.match(pattern) || clean.match(pattern);
        if (match?.[3]) add(match[3]);

        const previous = toNumber(match?.[1]);
        const current = toNumber(match?.[2]);
        if (previous > 0 && current > previous) add(current - previous);
    }

    // Fallback direct "2169 kWh" candidates. This is lower priority
    // because tariff block rows can also contain kWh values.
    const directMatches = [...original.matchAll(/([\d,]+(?:\.\d+)?)\s*kWh/gi)];
    for (const match of directMatches) {
        add(match[1]);
    }

    return pickBestKwhCandidate(candidates);
}

function resolveFuelVolume(item: any, rawText: string) {
    if (validPositive(item?.quantity)) return null;

    const text = String(rawText || "");
    const match = text.match(/([\d,]+(?:\.\d+)?)\s*(?:litre|liter|litres|liters|ltr|l)\b/i);
    if (!match?.[1]) return null;

    return {
        quantity: toNumber(match[1]),
        unit: "l",
        reason: "resolved_fuel_volume_from_invoice_text",
    };
}

function resolveWaterVolume(item: any, rawText: string) {
    if (validPositive(item?.quantity)) return null;

    const text = String(rawText || "");
    const match = text.match(/([\d,]+(?:\.\d+)?)\s*(?:m3|m³|cubic\s*meter|cubic\s*metre)\b/i);
    if (!match?.[1]) return null;

    return {
        quantity: toNumber(match[1]),
        unit: "m3",
        reason: "resolved_water_volume_from_invoice_text",
    };
}

function shouldOverrideElectricity(item: any, resolvedKwh: number) {
    if (!resolvedKwh || resolvedKwh <= 0) return false;

    const current = toNumber(item?.quantity);
    const unit = safeLower(item?.unit);

    if (!current || current <= 0) return true;
    if (!unit.includes("kwh")) return true;

    // If extractor picked first tariff block like 200 but total is 2169,
    // override to the total. Avoid tiny differences by using a threshold.
    if (resolvedKwh > current && resolvedKwh / current >= 1.25) return true;

    return false;
}

/**
 * Resolves/overrides quantities after extraction and before normalization/calculation.
 * This prevents every parser from needing manual fixes.
 */
export function resolveLineItemQuantities(input: {
    items: any[];
    rawText?: string;
    fileName?: string;
}) {
    const rawText = input.rawText || "";
    const fileName = input.fileName || "";

    return (input.items || []).map((item) => {
        const classification = classifyInvoiceDocument({
            text: `${rawText} ${item?.item_name || ""} ${item?.description || ""}`,
            fileName,
            itemName: item?.item_name || item?.description || "",
            unit: item?.unit || "",
        });

        const category = classification.category;

        if (category === "electricity_bill") {
            const kwh = resolveElectricityKwhFromText(rawText);

            if (shouldOverrideElectricity(item, kwh)) {
                return {
                    ...item,
                    quantity: kwh,
                    unit: "kWh",
                    parameters: {
                        ...(item.parameters || {}),
                        energy: kwh,
                        energy_kwh: kwh,
                        energy_unit: "kWh",
                        quantity_resolved: true,
                        quantity_resolution_method: "electricity_total_or_meter_difference",
                        original_extracted_quantity: item?.quantity ?? null,
                        original_extracted_unit: item?.unit ?? null,
                    },
                };
            }
        }

        if (category === "fuel") {
            const resolved = resolveFuelVolume(item, rawText);
            if (resolved) {
                return {
                    ...item,
                    quantity: resolved.quantity,
                    unit: resolved.unit,
                    parameters: {
                        ...(item.parameters || {}),
                        quantity_resolved: true,
                        quantity_resolution_method: resolved.reason,
                    },
                };
            }
        }

        if (category === "water") {
            const resolved = resolveWaterVolume(item, rawText);
            if (resolved) {
                return {
                    ...item,
                    quantity: resolved.quantity,
                    unit: resolved.unit,
                    parameters: {
                        ...(item.parameters || {}),
                        quantity_resolved: true,
                        quantity_resolution_method: resolved.reason,
                    },
                };
            }
        }

        return item;
    });
}
