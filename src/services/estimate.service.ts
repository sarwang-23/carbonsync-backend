import * as fs from "fs";
import { affindaClient } from "../lib/affinda.js";
import { normalizeLineItem } from "../pipeline/orchestrator.js";
import type { LineItem, PipelineResult } from "../types/index.js";

/**
 * Processes a document using the Affinda API and normalizes the extracted line items.
 * @param filePath The local path to the uploaded document file.
 * @returns The normalized line items from the document.
 */
export const processDocumentService = async (filePath: string) => {
    const workspaceId = process.env.AFFINDA_WORKSPACE_ID;

    if (!workspaceId) {
        throw new Error("Affinda workspace ID not configured");
    }

    try {
        const doc = await affindaClient.createDocument({
            file: fs.createReadStream(filePath),
            workspace: workspaceId,
            compact: "true",
        });

        // Extract line items from Affinda response
        const affindaData = doc.data as any;
        
        // Transform Affinda data to LineItem format and process through normalization pipeline
        const lineItems = Array.isArray(affindaData?.lineItems) 
            ? affindaData.lineItems 
            : [];

        const normalizedResults: Array<{
            original: LineItem;
            normalized: PipelineResult;
        }> = [];

        for (const item of lineItems) {
            // Map Affinda fields to LineItem interface
            const lineItem: LineItem = {
                description: item.description || item.name || "",
                quantity: parseFloat(item.quantity) || 1,
                unitPrice: parseFloat(item.unitPrice) || parseFloat(item.price) || 0,
            };

            // Process through normalization pipeline
            const pipelineResult = await normalizeLineItem(lineItem);

            normalizedResults.push({
                original: lineItem,
                normalized: pipelineResult,
            });
        }

        // Return enriched document data with normalized line items
        return {
            ...affindaData,
            lineItems: normalizedResults,
            normalizedAt: new Date().toISOString(),
        };
    } catch (error: any) {
        throw new Error(`Affinda processing failed: ${error.message || "Unknown error"}`);
    }
};