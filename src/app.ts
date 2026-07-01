import "dotenv/config";
import express from "express";
import cors from "cors";
import erpRoutes from "./routes/erp.routes.js";
import affindaTestRoutes from "./routes/affinda-test.routes.js";
import { calculateGermanyEmission } from "./services/GermanyEmission.service.js";
import { calculateIndiaFixedEmission } from "./services/IndiaFixedEmission.service.js";
import { calculateIndiaEmission } from "./services/IndiaEmission.service.js";
import { processInvoiceEmissions } from "./services/InvoiceEmission.service.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

app.use("/api/erp", erpRoutes);
app.use("/api/affinda", affindaTestRoutes);

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

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "ERP Malaysia Invoice Emission API running",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});