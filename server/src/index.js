import "dotenv/config";

import express from "express";
import cors from "cors";

import activityRoutes from "./routes/activityRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

const app = express();
app.set("trust proxy", 1);
const configuredOrigins = (process.env.FRONTEND_URL || process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .map((origin) => origin.replace(/\/$/, ""))
  .filter(Boolean);
const allowedOrigins = [...new Set([
  "http://localhost:5173",
  ...configuredOrigins,
  "https://smart-activity-report-generator.vercel.app",
  "https://smart-activity-report-generator-1kz3-l12r371kv.vercel.app"
])];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS."));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Accept", "Authorization", "Content-Type", "Origin", "X-Requested-With"],
  exposedHeaders: ["Content-Disposition", "Content-Length", "Content-Type"],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

app.use(express.json({ limit: "80mb" }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Smart Activity Report Generator API is running!"
  });
});

app.get("/health", (req, res) => {
  res.json({ success: true, status: "ok" });
});

app.get("/api/health", (req, res) => {
  res.json({ success: true, status: "ok" });
});

// AI activity routes
app.use("/api/activities", activityRoutes);
app.use("/api/reports", reportRoutes);

// Handle upload and API errors
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);

  if (err.message === "Origin is not allowed by CORS.") {
    return res.status(403).json({
      success: false,
      message: "This frontend origin is not allowed to access the API."
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Report payload is too large. Reduce the image sizes or number of activities."
    });
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "Image size must not exceed 8 MB."
    });
  }

  if (err.code === "LIMIT_FILE_COUNT") {
    return res.status(400).json({
      success: false,
      message: "Maximum 5 images allowed per batch."
    });
  }

  return res.status(err.statusCode || err.status || 500).json({
    success: false,
    message: err.statusCode || err.status ? err.message : "Something went wrong."
  });
});

const PORT = Number.parseInt(process.env.PORT || "5000", 10);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});