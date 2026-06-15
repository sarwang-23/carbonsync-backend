import { Router } from "express";
import { AffindaAPI, AffindaCredential } from "@affinda/affinda";
import { uploadHandler } from "../lib/multer.js";
import { estimateController } from "../controllers/estimate.controller.js";

const router = Router();

router.post("/estimate",uploadHandler,estimateController);


export default router;