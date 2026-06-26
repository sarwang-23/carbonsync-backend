export type SupportedCountry = "IN" | "MY";

export type DocumentType =
    | "ELECTRICITY_BILL"
    | "TRAIN_TICKET"
    | "FLIGHT_TICKET"
    | "FUEL_INVOICE"
    | "TRANSPORT_LOGISTICS"
    | "PURCHASED_GOODS"
    | "WATER_BILL"
    | "WASTE_INVOICE"
    | "HOTEL_INVOICE"
    | "GENERIC_INVOICE"
    | "UNKNOWN";

export type DetectedCategory =
    | "electricity_bill"
    | "train_ticket"
    | "flight_ticket"
    | "fuel"
    | "transport_logistics"
    | "purchased_goods"
    | "water"
    | "waste"
    | "hotel"
    | "unknown";

export interface ClassificationResult {
    country: SupportedCountry;
    country_confidence: number;
    document_type: DocumentType;
    category: DetectedCategory;
    document_type_confidence: number;
    signals: {
        malaysia: string[];
        india: string[];
        electricity: string[];
        train: string[];
        flight: string[];
        fuel: string[];
        logistics: string[];
        purchased_goods: string[];
        water: string[];
        waste: string[];
        hotel: string[];
    };
    audit: {
        classification_method: string;
        malaysia_score: number;
        india_score: number;
        document_scores: Record<string, number>;
        default_region: string;
    };
}

function safeLower(value: any): string {
    return String(value || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
}

function findSignals(text: string, keywords: string[]) {
    return keywords.filter((keyword) => text.includes(keyword.toLowerCase()));
}

function scoreFromSignals(signals: string[], weight = 1) {
    return signals.length * weight;
}

const MALAYSIA_SIGNALS = [
    "malaysia",
    "kuala lumpur",
    "selangor",
    "petaling jaya",
    "tenaga nasional",
    "tenaga nasional berhad",
    "tnb",
    "mytnb",
    "jompay",
    "bil elektrik",
    "bil terperinci",
    "caj semasa",
    "jumlah bil anda",
    "jumlah penggunaan",
    "kegunaan",
    "penggunaan tnb",
    "kedai tenaga",
    "sarawak energy",
    "sabah electricity",
    "rm ",
    "myr",
];

const INDIA_SIGNALS = [
    "india",
    "inr",
    "₹",
    "rs.",
    "gstin",
    "cgst",
    "sgst",
    "igst",
    "bescom",
    "tata power",
    "dhbvn",
    "mahadiscom",
    "adani electricity",
    "irctc",
    "pnr",
    "indigo",
    "air india",
    "vistara",
    "akasa",
    "spicejet",
];

const ELECTRICITY_SIGNALS = [
    "electricity",
    "electric bill",
    "electricity bill",
    "energy charge",
    "meter reading",
    "previous reading",
    "current reading",
    "kwh",
    "kw h",
    "tenaga nasional",
    "tnb",
    "bil elektrik",
    "kegunaan",
    "jumlah penggunaan",
    "bacaan meter",
    "caj semasa",
    "bescom",
    "dhbvn",
    "tata power",
    "adani electricity",
];

const TRAIN_SIGNALS = [
    "irctc",
    "pnr",
    "train no",
    "train number",
    "coach",
    "seat",
    "berth",
    "from station",
    "to station",
    "boarding station",
    "passenger",
    "railway",
    "rail",
];

const FLIGHT_SIGNALS = [
    "boarding pass",
    "flight no",
    "flight number",
    "pnr",
    "departure",
    "arrival",
    "airport",
    "terminal",
    "gate",
    "indigo",
    "air india",
    "vistara",
    "akasa",
    "spicejet",
    "boarding time",
];

const FUEL_SIGNALS = [
    "diesel",
    "petrol",
    "gasoline",
    "fuel",
    "cng",
    "lng",
    "natural gas",
    "litre",
    "liter",
    "ltr",
];

const LOGISTICS_SIGNALS = [
    "freight",
    "logistics",
    "shipment",
    "cargo",
    "container",
    "courier",
    "transport",
    "truck",
    "road freight",
    "air freight",
    "sea freight",
];

const PURCHASED_GOODS_SIGNALS = [
    "steel",
    "aluminium",
    "aluminum",
    "cement",
    "timber",
    "wood",
    "plywood",
    "textile",
    "fabric",
    "plastic",
    "paper",
    "raw material",
    "manufacturing",
];

const WATER_SIGNALS = [
    "water",
    "water bill",
    "water supply",
    "sewerage",
    "m3",
    "cubic meter",
    "cubic metre",
];

const WASTE_SIGNALS = [
    "waste",
    "landfill",
    "recycling",
    "scrap",
    "incineration",
    "disposal",
];

const HOTEL_SIGNALS = [
    "hotel",
    "accommodation",
    "room night",
    "room nights",
    "check in",
    "check out",
];

/**
 * Detect country with scoring.
 * Region-specific fixed EF logic depends on this being stable.
 */
export function detectCountry(text: string, fileName = "") {
    const combined = safeLower(`${text || ""} ${fileName || ""}`);

    const malaysiaSignals = findSignals(combined, MALAYSIA_SIGNALS);
    const indiaSignals = findSignals(combined, INDIA_SIGNALS);

    let malaysiaScore = scoreFromSignals(malaysiaSignals, 2);
    let indiaScore = scoreFromSignals(indiaSignals, 2);

    if (/\brm\s?\d/i.test(combined)) malaysiaScore += 3;
    if (combined.includes(" myr")) malaysiaScore += 3;

    if (combined.includes("₹")) indiaScore += 3;
    if (/\binr\s?\d/i.test(combined)) indiaScore += 3;
    if (/\brs\.?\s?\d/i.test(combined)) indiaScore += 2;

    const defaultRegion = (process.env.DEFAULT_INVOICE_REGION as SupportedCountry) || "IN";

    let country: SupportedCountry = defaultRegion;
    let confidence = 0.55;

    if (malaysiaScore > indiaScore && malaysiaScore >= 2) {
        country = "MY";
        confidence = malaysiaScore >= 8 ? 0.98 : malaysiaScore >= 4 ? 0.9 : 0.75;
    } else if (indiaScore > malaysiaScore && indiaScore >= 2) {
        country = "IN";
        confidence = indiaScore >= 8 ? 0.98 : indiaScore >= 4 ? 0.9 : 0.75;
    }

    return {
        country,
        confidence,
        malaysiaScore,
        indiaScore,
        malaysiaSignals,
        indiaSignals,
        defaultRegion,
    };
}

/**
 * Detect document type and mapped emission category.
 */
export function detectDocumentType(text: string, itemName = "", unit = "") {
    const combined = safeLower(`${text || ""} ${itemName || ""} ${unit || ""}`);

    const electricitySignals = findSignals(combined, ELECTRICITY_SIGNALS);
    const trainSignals = findSignals(combined, TRAIN_SIGNALS);
    const flightSignals = findSignals(combined, FLIGHT_SIGNALS);
    const fuelSignals = findSignals(combined, FUEL_SIGNALS);
    const logisticsSignals = findSignals(combined, LOGISTICS_SIGNALS);
    const purchasedGoodsSignals = findSignals(combined, PURCHASED_GOODS_SIGNALS);
    const waterSignals = findSignals(combined, WATER_SIGNALS);
    const wasteSignals = findSignals(combined, WASTE_SIGNALS);
    const hotelSignals = findSignals(combined, HOTEL_SIGNALS);

    const scores: Record<string, number> = {
        ELECTRICITY_BILL: scoreFromSignals(electricitySignals, 3),
        TRAIN_TICKET: scoreFromSignals(trainSignals, 3),
        FLIGHT_TICKET: scoreFromSignals(flightSignals, 3),
        FUEL_INVOICE: scoreFromSignals(fuelSignals, 2),
        TRANSPORT_LOGISTICS: scoreFromSignals(logisticsSignals, 2),
        PURCHASED_GOODS: scoreFromSignals(purchasedGoodsSignals, 2),
        WATER_BILL: scoreFromSignals(waterSignals, 2),
        WASTE_INVOICE: scoreFromSignals(wasteSignals, 2),
        HOTEL_INVOICE: scoreFromSignals(hotelSignals, 2),
        GENERIC_INVOICE: combined.includes("invoice") || combined.includes("bill") ? 1 : 0,
        UNKNOWN: 0,
    };

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [bestType, bestScore] = sorted[0];

    let documentType = bestScore > 0 ? (bestType as DocumentType) : "UNKNOWN";
    let category: DetectedCategory = "unknown";

    if (documentType === "ELECTRICITY_BILL") category = "electricity_bill";
    else if (documentType === "TRAIN_TICKET") category = "train_ticket";
    else if (documentType === "FLIGHT_TICKET") category = "flight_ticket";
    else if (documentType === "FUEL_INVOICE") category = "fuel";
    else if (documentType === "TRANSPORT_LOGISTICS") category = "transport_logistics";
    else if (documentType === "PURCHASED_GOODS") category = "purchased_goods";
    else if (documentType === "WATER_BILL") category = "water";
    else if (documentType === "WASTE_INVOICE") category = "waste";
    else if (documentType === "HOTEL_INVOICE") category = "hotel";

    let confidence = 0.45;
    if (bestScore >= 9) confidence = 0.97;
    else if (bestScore >= 6) confidence = 0.9;
    else if (bestScore >= 3) confidence = 0.75;

    return {
        document_type: documentType,
        category,
        confidence,
        scores,
        signals: {
            electricity: electricitySignals,
            train: trainSignals,
            flight: flightSignals,
            fuel: fuelSignals,
            logistics: logisticsSignals,
            purchased_goods: purchasedGoodsSignals,
            water: waterSignals,
            waste: wasteSignals,
            hotel: hotelSignals,
        },
    };
}

/**
 * Single classification call for raw invoice text + item.
 */
export function classifyInvoiceDocument(input: {
    text: string;
    fileName?: string;
    itemName?: string;
    unit?: string;
}): ClassificationResult {
    const countryResult = detectCountry(input.text, input.fileName || "");
    const documentResult = detectDocumentType(input.text, input.itemName || "", input.unit || "");

    return {
        country: countryResult.country,
        country_confidence: countryResult.confidence,
        document_type: documentResult.document_type,
        category: documentResult.category,
        document_type_confidence: documentResult.confidence,
        signals: {
            malaysia: countryResult.malaysiaSignals,
            india: countryResult.indiaSignals,
            electricity: documentResult.signals.electricity,
            train: documentResult.signals.train,
            flight: documentResult.signals.flight,
            fuel: documentResult.signals.fuel,
            logistics: documentResult.signals.logistics,
            purchased_goods: documentResult.signals.purchased_goods,
            water: documentResult.signals.water,
            waste: documentResult.signals.waste,
            hotel: documentResult.signals.hotel,
        },
        audit: {
            classification_method: "score_based_country_and_document_type_detection",
            malaysia_score: countryResult.malaysiaScore,
            india_score: countryResult.indiaScore,
            document_scores: documentResult.scores,
            default_region: countryResult.defaultRegion,
        },
    };
}
