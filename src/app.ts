import "dotenv/config";
import express from "express";
import cors from "cors";
import erpRoutes from "./routes/erp.routes.js";
import affindaTestRoutes from "./routes/affinda-test.routes.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "20mb" }));

app.use("/api/erp", erpRoutes);
app.use("/api/affinda", affindaTestRoutes);

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