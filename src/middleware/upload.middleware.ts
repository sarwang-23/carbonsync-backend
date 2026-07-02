/**
 * upload.middleware.ts — Single, canonical Multer configuration for the entire backend.
 *
 * Rules:
 * - Memory storage only (Render/cloud compatible — no disk dependency)
 * - Field name: "file" (consistent across all routes)
 * - Max size: 15 MB
 * - Allowed types: PDF, PNG, JPG, JPEG
 * - Global Multer error handler exported separately for app.ts
 */

import multer, { type FileFilterCallback } from "multer";
import type { Request } from "express";

const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
];

const MAX_FILE_SIZE_MB = 15;

const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF, PNG, and JPG are allowed.`));
    }
};

const upload = multer({
    storage: multer.memoryStorage(), // No disk writes — Render compatible
    limits: {
        fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
    },
    fileFilter,
});

/** 
 * Strict single file upload middleware.
 * Accepts "file" field name from frontend.
 */
export const uploadSingle = upload.single("file");

/** Legacy alias */
export const uploadHandler = uploadSingle;

/**
 * Global Multer error handler.
 * Mount AFTER all routes in app.ts:
 *   app.use(multerErrorHandler);
 */
export function multerErrorHandler(
    err: any,
    req: Request,
    res: any,
    next: any
) {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
                success: false,
                error: "FILE_TOO_LARGE",
                message: `File exceeds the ${MAX_FILE_SIZE_MB} MB size limit.`,
            });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
                success: false,
                error: "INVALID_FIELD_NAME",
                message: `Unexpected field name: '${err.field}'. Allowed fields are 'file', 'invoice', or 'document'.`,
                receivedField: err.field
            });
        }
        return res.status(400).json({
            success: false,
            error: "UPLOAD_ERROR",
            message: err.message,
        });
    }

    if (err && err.message?.includes("Invalid file type")) {
        return res.status(400).json({
            success: false,
            error: "INVALID_FILE_TYPE",
            message: err.message,
            // Cannot easily access req.file here because it was rejected by the filter, 
            // but the error message itself contains the received mimetype.
        });
    }

    next(err);
}
