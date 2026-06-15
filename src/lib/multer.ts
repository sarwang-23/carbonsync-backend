//for file handling

import multer, {type FileFilterCallback } from "multer";
import type { Request } from "express";

const upload = multer({ 
    dest: "uploads/",
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req: Request, file: any, cb: FileFilterCallback) => {
        const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Only PDF, PNG, and JPG are allowed."));
        }
    }
});
export const uploadHandler = upload.single("document");

