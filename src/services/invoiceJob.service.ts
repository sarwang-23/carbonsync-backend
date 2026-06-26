import crypto from "crypto";
import fs from "fs";

export type InvoiceJobStatus = "queued" | "processing" | "completed" | "failed";

export interface InvoiceJob {
    id: string;
    status: InvoiceJobStatus;
    progress: number;
    fileName: string;
    filePath: string;
    mimetype: string;
    size?: number;
    result?: any;
    error_message?: string;
    warnings: string[];
    created_at: string;
    updated_at: string;
}

type ProcessorInput = {
    filePath: string;
    fileName: string;
    mimetype: string;
};

type ProcessorFunction = (input: ProcessorInput) => Promise<any>;

const jobs = new Map<string, InvoiceJob>();

function nowIso() {
    return new Date().toISOString();
}

function updateJob(jobId: string, patch: Partial<InvoiceJob>) {
    const existing = jobs.get(jobId);
    if (!existing) return null;

    const updated: InvoiceJob = {
        ...existing,
        ...patch,
        updated_at: nowIso(),
    };

    jobs.set(jobId, updated);
    return updated;
}

export function createInvoiceJob(file: {
    originalname?: string;
    filename?: string;
    path: string;
    mimetype?: string;
    size?: number;
}) {
    const id = crypto.randomUUID();

    const job: InvoiceJob = {
        id,
        status: "queued",
        progress: 0,
        fileName: file.originalname || file.filename || "invoice",
        filePath: file.path,
        mimetype: file.mimetype || "",
        size: file.size,
        warnings: [],
        created_at: nowIso(),
        updated_at: nowIso(),
    };

    jobs.set(id, job);
    return job;
}

export function getInvoiceJob(jobId: string) {
    return jobs.get(jobId) || null;
}

export function listInvoiceJobs() {
    return Array.from(jobs.values()).sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
    );
}

export function startInvoiceJob(jobId: string, processor: ProcessorFunction) {
    const job = jobs.get(jobId);

    if (!job) {
        throw new Error(`Invoice job not found: ${jobId}`);
    }

    // Run outside the HTTP request-response cycle.
    setImmediate(async () => {
        try {
            updateJob(jobId, {
                status: "processing",
                progress: 10,
                warnings: ["Invoice processing started in background."],
            });

            if (!fs.existsSync(job.filePath)) {
                throw new Error(`Uploaded file not found at path: ${job.filePath}`);
            }

            updateJob(jobId, {
                progress: 25,
            });

            const result = await processor({
                filePath: job.filePath,
                fileName: job.fileName,
                mimetype: job.mimetype,
            });

            updateJob(jobId, {
                status: result?.success === false ? "failed" : "completed",
                progress: 100,
                result,
                error_message:
                    result?.success === false
                        ? result?.message || result?.error_type || "Invoice processing failed."
                        : undefined,
                warnings: [
                    ...(job.warnings || []),
                    ...(result?.warnings || []),
                ],
            });
        } catch (error: any) {
            updateJob(jobId, {
                status: "failed",
                progress: 100,
                error_message: error?.message || String(error),
                result: {
                    success: false,
                    needs_review: true,
                    error_type: "BACKGROUND_JOB_FAILED",
                    message: error?.message || String(error),
                },
                warnings: [
                    ...(job.warnings || []),
                    error?.message || String(error),
                ],
            });
        }
    });
}
