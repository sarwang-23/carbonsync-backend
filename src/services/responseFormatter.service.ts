/**
 * Clean response formatter for invoice upload API.
 * Use this before returning API response to frontend/Postman.
 */

function round(value: any, decimals = 6) {
    const num = Number(value || 0);
    if (!Number.isFinite(num)) return 0;
    return Number(num.toFixed(decimals));
}

function getEffectiveEF(co2e: number, quantity: number) {
    if (!quantity || quantity <= 0) return null;
    return round(co2e / quantity, 6);
}

function getPrimaryCalculation(result: any) {
    return (result?.calculation_results || []).find((r: any) => r?.success) || result?.calculation_results?.[0] || null;
}

function getSelectedFactor(calc: any) {
    return calc?.selected_emission_factor || calc?.mapping?.selected_emission_factor || null;
}

export function buildStructuredInvoiceResponse(fullResponse: any) {
    const result = fullResponse?.result || fullResponse;
    const calc = getPrimaryCalculation(result);
    const selectedFactor = getSelectedFactor(calc);

    const extractedItems = (result?.extracted_items || []).map((item: any, index: number) => {
        const itemCalc = result?.calculation_results?.[index] || calc;
        const co2e = Number(itemCalc?.result?.co2e || 0);
        const quantity = Number(item?.quantity || 0);

        return {
            item_name: item?.item_name || item?.description || "Unknown item",
            category: itemCalc?.category || null,
            quantity,
            unit: item?.unit || null,
            amount: item?.amount ?? null,
            currency: item?.currency || null,
            co2e_kg: round(co2e),
            co2e_tonne: round(co2e / 1000),
            effective_ef: getEffectiveEF(co2e, quantity),
            ef_unit: item?.unit ? `kgCO2e/${item.unit}` : null,
        };
    });

    return {
        success: Boolean(result?.success),
        status: fullResponse?.status || (result?.success ? "completed" : "failed"),
        job_id: fullResponse?.job_id || result?.job_id || null,
        message: result?.message || fullResponse?.message || "",

        file: {
            name: fullResponse?.file?.fileName || result?.file?.fileName || null,
            type: fullResponse?.file?.mimetype || result?.file?.mimetype || null,
        },

        extraction: {
            method: result?.extraction?.method || null,
            confidence: result?.extraction?.confidence ?? null,
            items_found: Number(result?.total_items || extractedItems.length || 0),
        },

        classification: {
            country: calc?.country || null,
            document_type: calc?.classification?.document_type || null,
            category: calc?.category || null,
            confidence: calc?.classification?.document_type_confidence ?? null,
        },

        calculation: {
            total_items: Number(result?.total_items || 0),
            successful_items: Number(result?.successful_items || 0),
            failed_items: Number(result?.failed_items || 0),
            total_kgco2e: round(result?.total_kgco2e),
            total_tco2e: round(result?.total_tco2e),
        },

        emission_factor: selectedFactor
            ? {
                  activity_id: selectedFactor.activity_id || null,
                  name: selectedFactor.name || null,
                  source: selectedFactor.source || null,
                  dataset: selectedFactor.source_dataset || null,
                  year: selectedFactor.year || null,
                  region: selectedFactor.region || null,
                  unit: selectedFactor.unit || null,
              }
            : null,

        climatiq: calc?.climatiqBody
            ? {
                  activity_id: calc.climatiqBody?.emission_factor?.activity_id || null,
                  region: calc.climatiqBody?.emission_factor?.region || null,
                  year: calc.climatiqBody?.emission_factor?.year || null,
                  parameters: calc.climatiqBody?.parameters || null,
              }
            : null,

        items: extractedItems,

        warnings: (result?.warnings || [])
            .filter((warning: any) => {
                const text = String(warning || "").toLowerCase();
                return (
                    !text.includes("ocr warning") &&
                    !text.includes("chrome") &&
                    !text.includes("pdfjs") &&
                    !text.includes("tesseract") &&
                    !text.includes("screenshot path")
                );
            })
            .slice(0, 5),
    };
}
