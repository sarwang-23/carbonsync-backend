export type SupportedCountry = "IN" | "MY" | "DE" | "US" | "GB" | "FR" | "AU";

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
    | "DISTRICT_HEATING_BILL"
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
    | "district_heating"
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
    return keywords.filter((keyword) => {
        const lowerKeyword = keyword.toLowerCase();
        // Use non-word boundary matching for all alphanumeric-like keywords to avoid substring false positives
        if (/^[a-z0-9\säöüß]+$/i.test(lowerKeyword)) {
            return new RegExp(`(^|\\W)${lowerKeyword}(?=\\W|$)`, 'i').test(text);
        } else {
            return text.toLowerCase().includes(lowerKeyword);
        }
    });
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
    "grid electricity",
    "strom",
    "stromrechnung",
    "netzstrom",
    "elektrizität",
    "electricity consumption",
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
    "dieselkraftstoff",
    "petrol",
    "benzin",
    "super",
    "super e10",
    "gasoline",
    "fuel",
    "cng",
    "lng",
    "natural gas",
    "litre",
    "liter",
    "ltr",
    "gas bill",
    "erdgas",
    "gasrechnung",
    "gasverbrauch",
    "gas consumption",
    "heating gas",
    "netzgas",
    "heating oil",
    "heizöl",
    "fuel oil",
    "gazole",
];

const DISTRICT_HEATING_SIGNALS = [
    "district heating",
    "heat",
    "heating",
    "fernwärme",
    "fernwaerme",
    "wärme",
    "heat supply",
    "wärmenetz",
    "heat network",
    "heating energy"
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
    "pinewood",
    "plywood",
    "veneer",
    "laminate",
    "laminates",
    "flush door",
    "door",
    "board",
    "mosaic",
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

const GERMANY_SIGNALS = [
    "deutschland",
    "germany",
    "bundesrepublik",
    "berlin",
    "münchen",
    "munich",
    "hamburg",
    "frankfurt",
    "leipzig",
    "stuttgart",
    "köln",
    "bonn",
    "de",
    "gmbh",
    "stadtwerke",
    "energie",
    "strom",
    "stromrechnung",
    "netzstrom",
    "erdgas",
    "gasrechnung",
    "fernwärme",
    "heizöl",
    "vat id",
    "ust-idnr",
];

const US_SIGNALS = [
    "united states",
    "usa",
    "usd",
    "$",
    "dollar",
    "washington",
    "new york",
    "california",
    "texas",
];

const GB_SIGNALS = [
    "united kingdom",
    "great britain",
    "gbp",
    "£",
    "pound",
    "london",
    "england",
    "scotland",
    "wales",
];

const FR_SIGNALS = [
    "france",
    "paris",
    "french",
    "tva",
    "siret",
];

const AU_SIGNALS = [
    "australia",
    "aud",
    "sydney",
    "melbourne",
    "brisbane",
    "abn",
    "acn",
];

/**
 * Detect country with scoring.
 * Region-specific fixed EF logic depends on this being stable.
 */
export function detectCountry(text: string, fileName = "") {
    const fnLower = String(fileName).trim().toLowerCase();

    // 1. Explicit Filename Prefix Check (Highest Priority)
    if (fnLower.startsWith("de_")) return { country: "DE" as SupportedCountry, confidence: 1.0, malaysiaScore: 0, indiaScore: 0, malaysiaSignals: [], indiaSignals: [], defaultRegion: "IN" };
    if (fnLower.startsWith("fr_")) return { country: "FR" as SupportedCountry, confidence: 1.0, malaysiaScore: 0, indiaScore: 0, malaysiaSignals: [], indiaSignals: [], defaultRegion: "IN" };
    if (fnLower.startsWith("my_")) return { country: "MY" as SupportedCountry, confidence: 1.0, malaysiaScore: 0, indiaScore: 0, malaysiaSignals: [], indiaSignals: [], defaultRegion: "IN" };
    if (fnLower.startsWith("in_")) return { country: "IN" as SupportedCountry, confidence: 1.0, malaysiaScore: 0, indiaScore: 0, malaysiaSignals: [], indiaSignals: [], defaultRegion: "IN" };
    if (fnLower.startsWith("us_")) return { country: "US" as SupportedCountry, confidence: 1.0, malaysiaScore: 0, indiaScore: 0, malaysiaSignals: [], indiaSignals: [], defaultRegion: "IN" };
    if (fnLower.startsWith("gb_") || fnLower.startsWith("uk_")) return { country: "GB" as SupportedCountry, confidence: 1.0, malaysiaScore: 0, indiaScore: 0, malaysiaSignals: [], indiaSignals: [], defaultRegion: "IN" };
    if (fnLower.startsWith("au_")) return { country: "AU" as SupportedCountry, confidence: 1.0, malaysiaScore: 0, indiaScore: 0, malaysiaSignals: [], indiaSignals: [], defaultRegion: "IN" };

    const combined = safeLower(`${text || ""} ${fileName || ""}`);

    const malaysiaSignals = findSignals(combined, MALAYSIA_SIGNALS);
    const indiaSignals = findSignals(combined, INDIA_SIGNALS);
    const germanySignals = findSignals(combined, GERMANY_SIGNALS);
    const usSignals = findSignals(combined, US_SIGNALS);
    const gbSignals = findSignals(combined, GB_SIGNALS);
    const frSignals = findSignals(combined, FR_SIGNALS);
    const auSignals = findSignals(combined, AU_SIGNALS);

    let malaysiaScore = scoreFromSignals(malaysiaSignals, 2);
    let indiaScore = scoreFromSignals(indiaSignals, 2);
    let germanyScore = scoreFromSignals(germanySignals, 2);
    let usScore = scoreFromSignals(usSignals, 2);
    let gbScore = scoreFromSignals(gbSignals, 2);
    let frScore = scoreFromSignals(frSignals, 2);
    let auScore = scoreFromSignals(auSignals, 2);

    if (/\brm\s?\d/i.test(combined)) malaysiaScore += 3;
    if (combined.includes(" myr")) malaysiaScore += 3;

    if (combined.includes("₹")) indiaScore += 3;
    if (/\binr\s?\d/i.test(combined)) indiaScore += 3;
    if (/\brs\.?\s?\d/i.test(combined)) indiaScore += 2;

    if (/(^|\W)(eur|€)(?=\W|$)/i.test(combined)) {
        germanyScore += 1;
        frScore += 1;
    }
    if (/(^|\W)aud(?=\W|$)/i.test(combined) || /\babn\b/.test(combined)) auScore += 3;
    if (/(^|\W)(gbp|£)(?=\W|$)/i.test(combined)) gbScore += 3;
    if (/(^|\W)usd(?=\W|$)/i.test(combined) || (combined.includes("$") && !/(^|\W)aud(?=\W|$)/i.test(combined))) usScore += 2;

    const scores = {
        MY: malaysiaScore,
        IN: indiaScore,
        DE: germanyScore,
        US: usScore,
        GB: gbScore,
        FR: frScore,
        AU: auScore
    };

    const defaultRegion = (process.env.DEFAULT_INVOICE_REGION as SupportedCountry) || "IN";

    let country: SupportedCountry = defaultRegion;
    let confidence = 0.55;
    let maxScore = 0;

    for (const [region, score] of Object.entries(scores)) {
        if (score > maxScore && score >= 2) {
            maxScore = score;
            country = region as SupportedCountry;
            confidence = score >= 8 ? 0.98 : score >= 4 ? 0.9 : 0.75;
        }
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
    const districtHeatingSignals = findSignals(combined, DISTRICT_HEATING_SIGNALS);

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
        DISTRICT_HEATING_BILL: scoreFromSignals(districtHeatingSignals, 3),
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
    else if (documentType === "DISTRICT_HEATING_BILL") category = "district_heating";

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
