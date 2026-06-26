export type NormalizedUnit =
    | "kWh"
    | "kg"
    | "t"
    | "l"
    | "m3"
    | "km"
    | "passenger-km"
    | "number"
    | "unknown";

export interface NormalizedLineItem {
    item_name: string;
    description?: string;
    original_quantity: any;
    original_unit: any;
    quantity: number;
    unit: NormalizedUnit;
    amount?: number | null;
    currency?: string | null;
    confidence?: number;
    source?: string;
    parameters?: Record<string, any>;
    warnings: string[];
    audit: {
        normalization_method: string;
        original_unit: any;
        normalized_unit: NormalizedUnit;
        original_quantity: any;
        normalized_quantity: number;
    };
}

function toNumber(value: any): number {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }

    const cleaned = String(value ?? "")
        .replace(/,/g, "")
        .replace(/[^\d.-]/g, "")
        .trim();

    const num = Number(cleaned);
    return Number.isFinite(num) ? num : 0;
}

function safeLower(value: any): string {
    return String(value || "").toLowerCase().trim();
}

function roundNumber(value: number, decimals = 6): number {
    return Number(Number(value || 0).toFixed(decimals));
}

export function normalizeUnit(unit: any, itemName = "", description = ""): NormalizedUnit {
    const text = safeLower(`${unit || ""} ${itemName || ""} ${description || ""}`)
        .replace(/\s+/g, " ")
        .trim();

    if (!text) return "unknown";

    if (
        text.includes("kwh") ||
        text.includes("kw h") ||
        text.includes("kw/h") ||
        text.includes("kilowatt")
    ) {
        return "kWh";
    }

    if (
        text === "kg" ||
        text.includes(" kg") ||
        text.includes("kgs") ||
        text.includes("kilogram") ||
        text.includes("kilograms")
    ) {
        return "kg";
    }

    if (
        text === "t" ||
        text === "mt" ||
        text.includes(" mt") ||
        text.includes("tonne") ||
        text.includes("tonnes") ||
        text.includes("metric ton") ||
        text.includes("metric tonne")
    ) {
        return "t";
    }

    if (
        text === "l" ||
        text.includes(" ltr") ||
        text.includes(" litre") ||
        text.includes(" liter") ||
        text.includes(" litres") ||
        text.includes(" liters")
    ) {
        return "l";
    }

    if (
        text.includes("m3") ||
        text.includes("m³") ||
        text.includes("cubic meter") ||
        text.includes("cubic metre")
    ) {
        return "m3";
    }

    if (
        text === "km" ||
        text.includes(" km") ||
        text.includes("kilometer") ||
        text.includes("kilometre")
    ) {
        return "km";
    }

    if (
        text.includes("passenger-km") ||
        text.includes("passenger km") ||
        text.includes("passenger kilometer") ||
        text.includes("passenger kilometre") ||
        text.includes("pkm")
    ) {
        return "passenger-km";
    }

    if (
        text.includes("room night") ||
        text.includes("night") ||
        text.includes("number") ||
        text.includes("pcs") ||
        text.includes("piece") ||
        text.includes("unit")
    ) {
        return "number";
    }

    return "unknown";
}

export function convertToBaseQuantity(quantity: any, unit: NormalizedUnit) {
    const value = toNumber(quantity);
    const warnings: string[] = [];

    if (!value || value <= 0) {
        warnings.push("Quantity is missing or invalid.");
        return {
            value: 0,
            unit,
            warnings,
        };
    }

    if (unit === "t") {
        return {
            value: roundNumber(value * 1000),
            unit: "kg" as NormalizedUnit,
            warnings,
        };
    }

    return {
        value: roundNumber(value),
        unit,
        warnings,
    };
}

export function normalizeCurrency(value: any): string | null {
    const text = safeLower(value);

    if (text.includes("myr") || text.includes("rm")) return "MYR";
    if (text.includes("inr") || text.includes("₹") || text.includes("rs")) return "INR";
    if (text.includes("usd") || text.includes("$")) return "USD";
    if (text.includes("gbp") || text.includes("£")) return "GBP";
    if (text.includes("eur") || text.includes("€")) return "EUR";

    return value ? String(value).toUpperCase() : null;
}

export function normalizeLineItem(item: any): NormalizedLineItem {
    const itemName = String(item?.item_name || item?.name || item?.description || "Unknown item");
    const description = String(item?.description || item?.item_description || "");

    const originalQuantity =
        item?.quantity ??
        item?.qty ??
        item?.parameters?.energy ??
        item?.parameters?.energy_kwh ??
        item?.parameters?.weight ??
        item?.parameters?.volume ??
        0;

    const originalUnit =
        item?.unit ??
        item?.uom ??
        item?.parameters?.energy_unit ??
        item?.parameters?.weight_unit ??
        item?.parameters?.volume_unit ??
        "";

    const normalizedUnit = normalizeUnit(originalUnit, itemName, description);
    const converted = convertToBaseQuantity(originalQuantity, normalizedUnit);

    const warnings = [...converted.warnings];

    if (normalizedUnit === "unknown") {
        warnings.push(`Unit could not be normalized from value: ${originalUnit || "missing"}`);
    }

    return {
        item_name: itemName,
        description,
        original_quantity: originalQuantity,
        original_unit: originalUnit,
        quantity: converted.value,
        unit: converted.unit,
        amount: item?.amount ? toNumber(item.amount) : item?.amount_myr ? toNumber(item.amount_myr) : null,
        currency: normalizeCurrency(item?.currency || item?.parameters?.currency || ""),
        confidence: Number(item?.confidence_score || item?.confidence || 0.75) || 0.75,
        source: item?.source || "line_item_normalizer",
        parameters: {
            ...(item?.parameters || {}),
            normalized_quantity: converted.value,
            normalized_unit: converted.unit,
        },
        warnings,
        audit: {
            normalization_method: "unit_and_quantity_normalization",
            original_unit: originalUnit,
            normalized_unit: converted.unit,
            original_quantity: originalQuantity,
            normalized_quantity: converted.value,
        },
    };
}

export function normalizeLineItems(items: any[]): NormalizedLineItem[] {
    if (!Array.isArray(items)) return [];
    return items.map(normalizeLineItem);
}

export function hasValidNormalizedQuantity(item: NormalizedLineItem) {
    return Boolean(item.quantity && item.quantity > 0 && item.unit !== "unknown");
}
