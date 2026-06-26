import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";

type ExpectedInvoiceResult = {
    filePath: string;
    expectedCountry?: string;
    expectedCategory?: string;
    expectedQuantity?: number;
    expectedUnit?: string;
    expectedFactorSource?: string;
    expectedFactorYear?: number;
    expectedMappingType?: string;
    allowNeedsReview?: boolean;
};

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:5000";

const TEST_CASES: ExpectedInvoiceResult[] = [
    {
        filePath: "test-files/malaysia-electricity/tnb-sample.pdf",
        expectedCountry: "MY",
        expectedCategory: "electricity_bill",
        expectedQuantity: 474,
        expectedUnit: "kWh",
        expectedFactorSource: "Ember",
        expectedFactorYear: 2024,
        expectedMappingType: "climatiq_latest_ember_electricity",
    },
    {
        filePath: "test-files/india-electricity/india-electricity-sample.pdf",
        expectedCountry: "IN",
        expectedCategory: "electricity_bill",
        expectedFactorSource: "India Region Fixed EF",
        expectedMappingType: "fixed_india_electricity",
        allowNeedsReview: true,
    },
    {
        filePath: "test-files/india-train/india-train-sample.pdf",
        expectedCountry: "IN",
        expectedCategory: "train_ticket",
        expectedFactorSource: "India Region Fixed EF",
        expectedMappingType: "fixed_india_train",
        allowNeedsReview: true,
    },
    {
        filePath: "test-files/india-flight/india-flight-sample.pdf",
        expectedCountry: "IN",
        expectedCategory: "flight_ticket",
        expectedFactorSource: "India Region Fixed EF",
        expectedMappingType: "fixed_india_flight",
        allowNeedsReview: true,
    },
];

function getNested(obj: any, paths: string[]) {
    for (const p of paths) {
        const parts = p.split(".");
        let current = obj;
        let ok = true;

        for (const part of parts) {
            if (current && Object.prototype.hasOwnProperty.call(current, part)) {
                current = current[part];
            } else {
                ok = false;
                break;
            }
        }

        if (ok && current !== undefined && current !== null) return current;
    }

    return undefined;
}

function nearlyEqual(a: number, b: number, tolerance = 1) {
    return Math.abs(Number(a || 0) - Number(b || 0)) <= tolerance;
}

function assertCheck(label: string, condition: boolean, details?: any) {
    if (condition) {
        console.log(`✅ ${label}`);
        return true;
    }

    console.log(`❌ ${label}`);
    if (details !== undefined) {
        console.log("   Details:", JSON.stringify(details, null, 2));
    }
    return false;
}

async function uploadInvoice(filePath: string) {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`Test file not found: ${absolutePath}`);
    }

    const form = new FormData();
    form.append("invoice", fs.createReadStream(absolutePath));

    const response = await axios.post(`${API_BASE_URL}/api/upload-invoice`, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        validateStatus: () => true,
    });

    return response;
}

function extractPrimaryCalculation(responseData: any) {
    return responseData?.calculation_results?.[0] || null;
}

function validateResponse(testCase: ExpectedInvoiceResult, responseData: any) {
    const result = extractPrimaryCalculation(responseData);
    let passed = true;

    console.log("\n--- Response Summary ---");
    console.log(
        JSON.stringify(
            {
                success: responseData?.success,
                needs_review: responseData?.needs_review,
                total_items: responseData?.total_items,
                successful_items: responseData?.successful_items,
                failed_items: responseData?.failed_items,
                total_kgco2e: responseData?.total_kgco2e,
                extraction_method: responseData?.extraction?.method,
                extraction_confidence: responseData?.extraction?.confidence,
            },
            null,
            2
        )
    );

    passed =
        assertCheck("API returned success or allowed needs_review", Boolean(responseData?.success || testCase.allowNeedsReview), {
            success: responseData?.success,
            needs_review: responseData?.needs_review,
            message: responseData?.message,
        }) && passed;

    passed =
        assertCheck("calculation_results exists", Array.isArray(responseData?.calculation_results), {
            calculation_results: responseData?.calculation_results,
        }) && passed;

    if (!result) {
        return false;
    }

    if (testCase.expectedCountry) {
        const country = getNested(result, ["country", "classification.country"]);
        passed =
            assertCheck(`country should be ${testCase.expectedCountry}`, country === testCase.expectedCountry, {
                actual: country,
                expected: testCase.expectedCountry,
            }) && passed;
    }

    if (testCase.expectedCategory) {
        const category = getNested(result, ["category", "classification.category"]);
        passed =
            assertCheck(`category should be ${testCase.expectedCategory}`, category === testCase.expectedCategory, {
                actual: category,
                expected: testCase.expectedCategory,
            }) && passed;
    }

    if (testCase.expectedQuantity !== undefined) {
        const quantity =
            getNested(result, ["converted.value", "normalization.quantity", "validation.extracted_quantity"]) ??
            responseData?.extracted_items?.[0]?.quantity;

        passed =
            assertCheck(`quantity should be near ${testCase.expectedQuantity}`, nearlyEqual(Number(quantity), testCase.expectedQuantity), {
                actual: quantity,
                expected: testCase.expectedQuantity,
            }) && passed;
    }

    if (testCase.expectedUnit) {
        const unit =
            getNested(result, ["converted.unit", "normalization.unit"]) ??
            responseData?.extracted_items?.[0]?.unit;

        passed =
            assertCheck(`unit should be ${testCase.expectedUnit}`, unit === testCase.expectedUnit, {
                actual: unit,
                expected: testCase.expectedUnit,
            }) && passed;
    }

    if (testCase.expectedFactorSource) {
        const source = getNested(result, [
            "selected_emission_factor.source",
            "mapping.selected_emission_factor.source",
            "result.source",
            "audit_trail.mapping.selected_source",
        ]);

        passed =
            assertCheck(`factor source should be ${testCase.expectedFactorSource}`, source === testCase.expectedFactorSource, {
                actual: source,
                expected: testCase.expectedFactorSource,
            }) && passed;
    }

    if (testCase.expectedFactorYear) {
        const year = getNested(result, [
            "selected_emission_factor.year",
            "mapping.selected_emission_factor.year",
            "result.factor_year",
            "audit_trail.mapping.selected_year",
        ]);

        passed =
            assertCheck(`factor year should be ${testCase.expectedFactorYear}`, Number(year) === testCase.expectedFactorYear, {
                actual: year,
                expected: testCase.expectedFactorYear,
            }) && passed;
    }

    if (testCase.expectedMappingType) {
        const mappingType = getNested(result, ["mapping.mapping_type", "audit_trail.mapping.mapping_type"]);

        passed =
            assertCheck(`mapping type should be ${testCase.expectedMappingType}`, mappingType === testCase.expectedMappingType, {
                actual: mappingType,
                expected: testCase.expectedMappingType,
            }) && passed;
    }

    const co2e = getNested(result, ["result.co2e", "co2e"]);
    passed =
        assertCheck("co2e should be calculated when item succeeded", result?.success ? Number(co2e) > 0 : true, {
            actual: co2e,
        }) && passed;

    return passed;
}

async function run() {
    console.log(`\nCarbonSync Invoice Pipeline Test`);
    console.log(`API_BASE_URL: ${API_BASE_URL}\n`);

    let passedCount = 0;
    let failedCount = 0;

    for (const testCase of TEST_CASES) {
        console.log("\n======================================");
        console.log(`Testing: ${testCase.filePath}`);
        console.log("======================================");

        try {
            if (!fs.existsSync(path.resolve(testCase.filePath))) {
                console.log(`⚠️ Skipped: file not found ${testCase.filePath}`);
                console.log("   Add your sample invoice at this path or update TEST_CASES.");
                continue;
            }

            const response = await uploadInvoice(testCase.filePath);

            console.log(`HTTP Status: ${response.status}`);

            const passed = validateResponse(testCase, response.data);

            if (passed) {
                passedCount++;
                console.log(`\n✅ PASSED: ${testCase.filePath}`);
            } else {
                failedCount++;
                console.log(`\n❌ FAILED: ${testCase.filePath}`);
            }
        } catch (error: any) {
            failedCount++;
            console.log(`\n❌ ERROR: ${testCase.filePath}`);
            console.log(error?.response?.data || error?.message || String(error));
        }
    }

    console.log("\n======================================");
    console.log("Test Summary");
    console.log("======================================");
    console.log(`Passed: ${passedCount}`);
    console.log(`Failed: ${failedCount}`);

    if (failedCount > 0) {
        process.exitCode = 1;
    }
}

run();
