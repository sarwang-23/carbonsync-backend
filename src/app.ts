import "dotenv/config";
import express from "express";
import cors from "cors";
import erpRoutes from "./routes/erp.routes.js";
import affindaTestRoutes from "./routes/affinda-test.routes.js";
import { calculateGermanyEmission } from "./services/GermanyEmission.service.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));

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