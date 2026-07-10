import { Router } from "express";
import { testTemplateRead, generateUKReport } from "../services/reports/uk/generator.js";

const router = Router();

// ─── Phase 1: Template Read Test ────────────────────────────────────────────
// GET /api/report/test-uk-template
router.get("/test-uk-template", async (_req, res) => {
  try {
    const result = await testTemplateRead();
    return res.json({
      success: true,
      message: "✅ UK template found and readable",
      template: result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ─── Phase 2: Generate UK Report ────────────────────────────────────────────
// GET /api/report/generate-uk-report
router.get("/generate-uk-report", async (_req, res) => {
  try {
    const file = await generateUKReport();
    return res.download(file);
  } catch (error: any) {
    console.error("UK Report generation failed:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
