import "dotenv/config";

import express from "express";
import cors from "cors";

import activityRoutes from "./routes/activityRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

const app = express();
app.set("trust proxy", 1);
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS."));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

app.use(express.json({ limit: "100mb" }));

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Smart Activity Report Generator API is running!"
  });
});

app.get("/health", (req, res) => {
  res.json({ success: true, status: "ok" });
});

// AI activity routes
app.use("/api/activities", activityRoutes);
app.use("/api/reports", reportRoutes);

// Handle upload and API errors
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);

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

  res.status(400).json({
    success: false,
    message: err.message || "Something went wrong."
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});