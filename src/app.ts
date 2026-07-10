import "dotenv/config";

console.log("DB CONFIG =", {
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
});
import express from "express";
import cors from "cors";
import erpRoutes from "./routes/erp.routes.js";
import affindaTestRoutes from "./routes/affinda-test.routes.js";
import { multerErrorHandler } from "./middleware/upload.middleware.js";
import { calculateGermanyEmission } from "./services/GermanyEmission.service.js";
import { calculateIndiaFixedEmission } from "./services/IndiaFixedEmission.service.js";
import { calculateIndiaEmission } from "./services/IndiaEmission.service.js";
import { processInvoiceEmissions } from "./services/InvoiceEmission.service.js";

const app = express();

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/api/erp", erpRoutes);
app.use("/api/affinda", affindaTestRoutes);
import path from "path";
app.use("/reports", express.static(path.join(process.cwd(), "reports")));
import { generateInvoiceEmissionReports } from "./services/Report.service.js";
import { testTemplateRead } from "./services/reports/uk/generator.js";

app.post("/api/generate-invoice-report", async (req, res) => {
  try {
    const payload = req.body;
    if (!payload) {
      return res.status(400).json({ success: false, message: "Payload is required" });
    }
    
    const reports = await generateInvoiceEmissionReports(payload);
    return res.json({
      success: true,
      reportUrls: {
        brsr: reports.brsr?.reportUrl || null,
        cbam: reports.cbam?.reportUrl || null,
      }
    });
  } catch (error: any) {
    console.error("Report generation failed:", error);
    return res.status(500).json({
      success: false,
      message: "Report generation failed",
      error: error.message
    });
  }
});

app.post("/api/test/germany-emission", async (req, res) => {
  try {
    const { category, value, unit } = req.body;

    if (!category || !value) {
      return res.status(400).json({
        success: false,
        message: "category and value are required",
      });
    }

    const result = await calculateGermanyEmission({
      category,
      value: Number(value),
      unit,
    });

    return res.json(result);
  } catch (error: any) {
    console.error("Germany test emission failed:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Germany test emission failed",
    });
  }
});

app.post("/api/test/india-emission", async (req, res) => {
  try {
    const { category, value, unit } = req.body;

    if (!category || !value) {
      return res.status(400).json({
        success: false,
        message: "category and value are required",
      });
    }

    const result = await calculateIndiaFixedEmission({
      category,
      value: Number(value),
      unit,
    });

    return res.json(result);
  } catch (error: any) {
    console.error("India test emission failed:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "India test emission failed",
    });
  }
});

app.post("/api/test/india-hybrid-emission", async (req, res) => {
  try {
    const { category, itemName, value, unit } = req.body;

    if (!category || !value || !unit) {
      return res.status(400).json({
        success: false,
        message: "category, value and unit are required",
      });
    }

    const result = await calculateIndiaEmission({
      category,
      itemName: itemName || category,
      value: Number(value),
      unit,
    });

    return res.json(result);
  } catch (error: any) {
    console.error("India hybrid emission failed:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "India hybrid emission failed",
    });
  }
});

app.post("/api/test/country-emission", async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        message: "Request body missing. Please ensure Content-Type is application/json",
      });
    }

    const { region, country_name, items } = req.body;

    if (!region || !country_name || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: "region, country_name and items[] are required",
      });
    }

    const result = await processInvoiceEmissions({
      region,
      country_name,
      invoice_year: null,
      items,
    });

    return res.json(result);
  } catch (error: any) {
    console.error("Country emission test failed:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Country emission test failed",
    });
  }
});

// ─── Phase 1: Template Read Test Route ─────────────────────────────────────
app.get("/api/report/test-uk-template", async (_req, res) => {
  try {
    const result = await testTemplateRead();
    return res.json({
      success: true,
      message: "✅ UK Template found and readable",
      template: result,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "ERP Malaysia Invoice Emission API running",
  });
});

// ── Global error handlers (must be AFTER all routes) ─────────────────────
app.use(multerErrorHandler);

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("[UNHANDLED ERROR]", err);
  return res.status(500).json({
    success: false,
    error: "INTERNAL_SERVER_ERROR",
    message: err?.message || "An unexpected error occurred.",
  });
});
// ─────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});