import { Router } from "express";
import { testTemplateRead, generateReport } from "../services/reports/uk/generator.js";

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

// ─── Phase 2+: Full UK Report Generation ────────────────────────────────────
// POST /api/report/generate-uk
// Body: any commonData / emission result object
router.post("/generate-uk", async (req, res) => {
  try {
    const commonData = req.body;
    const result = await generateReport(commonData);

    if (!result) {
      return res.status(500).json({
        success: false,
        message: "Report generation returned null. Check if template.docx exists.",
      });
    }

    return res.json({
      success: true,
      message: "✅ UK Report generated",
      report: result,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
