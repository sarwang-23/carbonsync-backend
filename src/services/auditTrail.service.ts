export interface AuditTrailInput {
    extraction?: any;
    classification?: any;
    normalization?: any;
    validation?: any;
    mapping?: any;
    calculation?: any;
    warnings?: any[];
}

function normalizeWarnings(warnings: any[] = []) {
    return warnings
        .filter(Boolean)
        .map((warning) => {
            if (typeof warning === "string") return warning;
            if (warning.message) return warning.message;
            return String(warning);
        });
}

/**
 * Builds one clean audit object for the final API response.
 * Pipeline:
 * extraction -> classification -> normalization -> validation -> mapping -> calculation
 */
export function buildAuditTrail(input: AuditTrailInput) {
    const warnings = [
        ...normalizeWarnings(input.warnings || []),
        ...normalizeWarnings(input.extraction?.warnings || []),
        ...normalizeWarnings(input.normalization?.warnings || []),
        ...normalizeWarnings(input.validation?.warnings || []),
        ...normalizeWarnings(input.mapping?.warnings || []),
    ];

    return {
        extraction: input.extraction
            ? {
                  method: input.extraction?.method || null,
                  confidence: input.extraction?.confidence ?? null,
                  text_length: input.extraction?.textLength ?? input.extraction?.text_length ?? null,
                  needs_review: input.extraction?.needs_review ?? false,
                  audit: input.extraction?.audit || null,
              }
            : null,

        classification: input.classification
            ? {
                  country: input.classification?.country || null,
                  country_confidence: input.classification?.country_confidence ?? null,
                  document_type: input.classification?.document_type || null,
                  category: input.classification?.category || null,
                  document_type_confidence: input.classification?.document_type_confidence ?? null,
                  signals: input.classification?.signals || null,
                  audit: input.classification?.audit || null,
              }
            : null,

        normalization: input.normalization
            ? {
                  item_name: input.normalization?.item_name || null,
                  original_quantity: input.normalization?.original_quantity ?? null,
                  original_unit: input.normalization?.original_unit ?? null,
                  normalized_quantity: input.normalization?.quantity ?? input.normalization?.normalized_quantity ?? null,
                  normalized_unit: input.normalization?.unit ?? input.normalization?.normalized_unit ?? null,
                  warnings: input.normalization?.warnings || [],
                  audit: input.normalization?.audit || null,
              }
            : null,

        validation: input.validation
            ? {
                  valid: input.validation?.valid ?? null,
                  needs_review: input.validation?.needs_review ?? null,
                  confidence: input.validation?.confidence ?? null,
                  expected_quantity: input.validation?.expected_quantity ?? null,
                  extracted_quantity: input.validation?.extracted_quantity ?? null,
                  warnings: input.validation?.warnings || [],
                  audit: input.validation?.audit || null,
              }
            : null,

        mapping: input.mapping
            ? {
                  success: input.mapping?.success ?? null,
                  mapping_type: input.mapping?.mapping_type || null,
                  confidence: input.mapping?.confidence ?? null,
                  reason: input.mapping?.reason || null,
                  selected_source: input.mapping?.selected_emission_factor?.source || null,
                  selected_year: input.mapping?.selected_emission_factor?.year || null,
                  selected_region: input.mapping?.selected_emission_factor?.region || null,
                  warnings: input.mapping?.warnings || [],
                  audit: input.mapping?.audit || null,
              }
            : null,

        calculation: input.calculation
            ? {
                  co2e: input.calculation?.co2e ?? null,
                  co2e_unit: input.calculation?.co2e_unit || null,
                  total_tco2e: input.calculation?.total_tco2e ?? null,
                  factor_name: input.calculation?.factor_name || null,
                  activity_id: input.calculation?.activity_id || null,
                  source: input.calculation?.source || null,
                  factor_year: input.calculation?.factor_year ?? null,
                  factor_region: input.calculation?.factor_region || null,
                  category: input.calculation?.category || null,
              }
            : null,

        warnings,
        overall_status: warnings.length ? "completed_with_warnings" : "completed",
    };
}

/**
 * Calculates one overall confidence from pipeline stage confidences.
 */
export function calculatePipelineConfidence(input: {
    extractionConfidence?: number;
    classificationConfidence?: number;
    normalizationConfidence?: number;
    validationConfidence?: number;
    mappingConfidence?: number;
}) {
    const values = [
        input.extractionConfidence,
        input.classificationConfidence,
        input.normalizationConfidence,
        input.validationConfidence,
        input.mappingConfidence,
    ].filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0) as number[];

    if (!values.length) return 0.4;

    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Number(avg.toFixed(3));
}

/**
 * Creates warnings for suspicious final outputs.
 */
export function buildResultWarnings(input: {
    country?: string;
    category?: string;
    selectedFactor?: any;
    validation?: any;
    extraction?: any;
}) {
    const warnings: string[] = [];

    if (
        input.category === "electricity_bill" &&
        Number(input.selectedFactor?.year || 0) > 0 &&
        Number(input.selectedFactor?.year || 0) < 2020
    ) {
        warnings.push(
            `Selected electricity EF year is ${input.selectedFactor.year}. Please verify because it is older than 2020.`
        );
    }

    if (input.validation?.needs_review) {
        warnings.push("Validation marked this item as needing review.");
    }

    if (input.extraction?.needs_review) {
        warnings.push("Extraction marked this invoice as needing review.");
    }

    if (
        input.country === "MY" &&
        input.category === "electricity_bill" &&
        input.selectedFactor?.source &&
        input.selectedFactor.source !== "Ember"
    ) {
        warnings.push("Malaysia electricity bill did not use Ember latest production mix. Please verify EF selection.");
    }

    return warnings;
}
