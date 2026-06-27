import crypto from "crypto";

export interface InvoiceJob {
    id: string;
    status: "pending" | "processing" | "completed" | "failed";
    progress: number;
    created_at: string;
    updated_at: string;
    fileName: string;
    filePath: string;
    mimetype: string;
    size: number;
    error_message?: string;
    warnings?: any[];
    result?: any;
}

const jobs = new Map<string, InvoiceJob>();

export function createInvoiceJob(file: Express.Multer.File): InvoiceJob {
    const id = crypto.randomUUID();
    const job: InvoiceJob = {
        id,
        status: "pending",
        progress: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        fileName: file.originalname,
        filePath: file.path,
        mimetype: file.mimetype,
        size: file.size,
    };
    jobs.set(id, job);
    return job;
}

export function getInvoiceJob(id: string): InvoiceJob | undefined {
    return jobs.get(id);
}

export function listInvoiceJobs(): InvoiceJob[] {
    return Array.from(jobs.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export function startInvoiceJob(id: string, processFn: (fileInfo: { filePath: string; fileName: string; mimetype: string }) => Promise<any>) {
    const job = jobs.get(id);
    if (!job) return;

    job.status = "processing";
    job.progress = 10;
    job.updated_at = new Date().toISOString();

    setImmediate(async () => {
        try {
            job.progress = 30;
            job.updated_at = new Date().toISOString();

            const result = await processFn({
                filePath: job.filePath,
                fileName: job.fileName,
                mimetype: job.mimetype,
            });

            job.status = "completed";
            job.progress = 100;
            job.result = result;
            if (result && result.warnings) {
                job.warnings = result.warnings;
            }
            job.updated_at = new Date().toISOString();
        } catch (error: any) {
            job.status = "failed";
            job.error_message = error?.message || "An unknown error occurred during processing.";
            job.updated_at = new Date().toISOString();
            console.error(`[Job ${id}] Failed:`, error);
        }
    });
}
