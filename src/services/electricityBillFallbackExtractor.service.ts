/**
 * Electricity bill fallback extractor.
 *
 * Use this before returning NO_INVOICE_ITEMS_EXTRACTED when OCR text exists.
 * Handles TNB Malaysia normal bills and LPC/TOU bills with:
 * - Penggunaan Puncak (kWh)
 * - Penggunaan Luar Puncak (kWh)
 * - meter rows: kWh P / kWh O / TENANT kWh
 */

export type ElectricityLineItem = {
    item_name: string;
    description: string;
    quantity: number;
    unit: string;
    amount: number | null;
    currency: string | null;
    confidence: number;
    source: string;
    parameters: Record<string, any>;
};

function toNumber(value: any): number {
    if (value === null || value === undefined) return 0;

    const raw = String(value)
        .replace(/,/g, "")
        .replace(/[^\d.\-]/g, "")
        .trim();

    if (!raw || raw === "-" || raw === ".") return 0;

    const num = Number(raw);
    return Number.isFinite(num) ? num : 0;
}

function round(value: number, decimals = 6) {
    return Number(Number(value || 0).toFixed(decimals));
}

function isTnbBill(text: string) {
    return /tenaga\s+nasional|tnb|mytnb|bil\s+terperinci|bil\s+elektrik/i.test(text);
}

function detectCurrency(text: string) {
    if (/\bRM\b|MYR|tenaga\s+nasional|tnb|malaysia|kuala\s+lumpur|selangor/i.test(text)) return "MYR";
    if (/₹|INR|Rs\.?|GSTIN|PAN\s+No/i.test(text)) return "INR";
    return null;
}

function extractTnbTouRows(text: string) {
    const peakMatch =
        text.match(/Penggunaan\s+Puncak\s*\(kWh\)\s*\|\s*([\d,]+(?:\.\d+)?)/i) ||
        text.match(/Penggunaan\s+Puncak\s*\(kWh\)\s+([\d,]+(?:\.\d+)?)/i);

    const offPeakMatch =
        text.match(/Penggunaan\s+Luar\s+Puncak\s*\(kWh\)\s*\|\s*([\d,]+(?:\.\d+)?)/i) ||
        text.match(/Penggunaan\s+Luar\s+Puncak\s*\(kWh\)\s+([\d,]+(?:\.\d+)?)/i);

    const peakKwh = toNumber(peakMatch?.[1]);
    const offPeakKwh = toNumber(offPeakMatch?.[1]);

    if (peakKwh > 0 || offPeakKwh > 0) {
        return {
            peakKwh,
            offPeakKwh,
            totalKwh: round(peakKwh + offPeakKwh),
            method: "tnb_tou_peak_offpeak_rows",
        };
    }

    return null;
}

function extractTnbMeterRows(text: string) {
    const normalized = String(text || "").replace(/\s+/g, " ");

    let kwhP = 0;
    let kwhO = 0;
    let tenantKwh = 0;

    const pMatches = [...String(text || "").matchAll(/\|\s*M\s*\d+\s*\|\s*[\d,.\-]+\s*\|\s*[\d,.\-]+\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|\s*kWh\s*P/gi)];
    for (const match of pMatches) kwhP = Math.max(kwhP, toNumber(match[1]));

    const oMatches = [...String(text || "").matchAll(/\|\s*M\s*\d+\s*\|\s*[\d,.\-]+\s*\|\s*[\d,.\-]+\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|\s*kWh\s*O/gi)];
    for (const match of oMatches) kwhO = Math.max(kwhO, toNumber(match[1]));

    const tenantMatches = [...String(text || "").matchAll(/\|\s*TENANT\s*\|\s*-?\s*\|\s*-?\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|\s*kWh\b/gi)];
    for (const match of tenantMatches) tenantKwh += toNumber(match[1]);

    if (!kwhP) {
        const m = normalized.match(/M\s*\d+\s+[\d,.]+\s+[\d,.]+\s+([\d,]+(?:\.\d+)?)\s+kWh\s*P/i);
        kwhP = toNumber(m?.[1]);
    }
    if (!kwhO) {
        const m = normalized.match(/M\s*\d+\s+[\d,.]+\s+[\d,.]+\s+([\d,]+(?:\.\d+)?)\s+kWh\s*O/i);
        kwhO = toNumber(m?.[1]);
    }
    if (!tenantKwh) {
        const m = normalized.match(/TENANT\s+-\s+-\s+([\d,]+(?:\.\d+)?)\s+kWh\b/i);
        tenantKwh = toNumber(m?.[1]);
    }

    if (kwhP > 0 || kwhO > 0) {
        const grossKwh = round(kwhP + kwhO);
        const netKwh = tenantKwh > 0 && grossKwh > tenantKwh ? round(grossKwh - tenantKwh) : grossKwh;

        return {
            kwhP,
            kwhO,
            tenantKwh,
            grossKwh,
            totalKwh: netKwh,
            method: tenantKwh > 0 ? "tnb_meter_peak_offpeak_minus_tenant" : "tnb_meter_peak_offpeak_rows",
        };
    }

    return null;
}

function extractSimpleTnbKwh(text: string) {
    const patterns = [
        /Jumlah\s+Penggunaan\s+Anda\s*\(?\s*([\d,]+(?:\.\d+)?)\s*kWh/i,
        /Jumlah\s+Penggunaan\s*\(?\s*([\d,]+(?:\.\d+)?)\s*kWh/i,
        /Jumlah\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        const value = toNumber(match?.[1]);
        if (value > 0) {
            return {
                totalKwh: value,
                method: "tnb_simple_total_kwh",
            };
        }
    }

    const meterMatch = text.match(/\|\s*[A-Z0-9\-]{4,}\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|\s*([\d,]+(?:\.\d+)?)\s*\|\s*kWh/i);
    if (meterMatch?.[3]) {
        return {
            totalKwh: toNumber(meterMatch[3]),
            method: "tnb_simple_meter_row",
        };
    }

    return null;
}

function extractAmount(text: string) {
    const patterns = [
        /Caj\s+Semasa\s+RM[\s|]*([\d,]+(?:\.\d+)?)/i,
        /Jumlah\s+Bil\s+Anda[\s\S]{0,80}?RM\s*([\d,]+(?:\.\d+)?)/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        const amount = toNumber(match?.[1]);
        if (amount > 0) return amount;
    }

    return null;
}

export function extractElectricityBillLineItems(rawText: string): ElectricityLineItem[] {
    const text = String(rawText || "");
    if (!text.trim()) return [];
    if (!isTnbBill(text)) return [];

    const tou = extractTnbTouRows(text);
    const meter = extractTnbMeterRows(text);
    const simple = extractSimpleTnbKwh(text);

    const selected = tou?.totalKwh ? tou : meter?.totalKwh ? meter : simple;

    if (!selected?.totalKwh || selected.totalKwh <= 0) return [];

    const amount = extractAmount(text);
    const currency = detectCurrency(text) || "MYR";

    return [
        {
            item_name: "TNB Malaysia Electricity Bill",
            description: "Malaysia TNB grid electricity consumption",
            quantity: selected.totalKwh,
            unit: "kWh",
            amount,
            currency,
            confidence: 0.86,
            source: "tnb_electricity_bill_fallback",
            parameters: {
                country: "MY",
                region: "MY",
                provider: "Tenaga Nasional Berhad",
                energy: selected.totalKwh,
                energy_kwh: selected.totalKwh,
                energy_unit: "kWh",
                extraction_method: selected.method,
                category: "electricity_bill",
                peak_kwh: (selected as any).peakKwh ?? (selected as any).kwhP ?? null,
                offpeak_kwh: (selected as any).offPeakKwh ?? (selected as any).kwhO ?? null,
                tenant_kwh: (selected as any).tenantKwh ?? null,
                gross_kwh: (selected as any).grossKwh ?? null,
            },
        },
    ];
}
