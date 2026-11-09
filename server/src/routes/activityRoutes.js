import express from "express";
import multer from "multer";
import sharp from "sharp";

import { generateActivityDescription } from "../services/aiService.js";
import { rateLimit } from "../middleware/security.js";

const router = express.Router();
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, callback) => {
    if (IMAGE_TYPES.includes(file.mimetype)) callback(null, true);
    else callback(new Error("Only JPG, PNG and WEBP images are allowed."));
  }
});

const pocUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, callback) => {
    if (IMAGE_TYPES.includes(file.mimetype)) callback(null, true);
    else callback(new Error("POC evidence must be a JPG, PNG or WEBP image."));
  }
});

async function validateImage(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    if (!["jpeg", "png", "webp"].includes(metadata.format) || !metadata.width || !metadata.height) {
      throw new Error("Invalid image format or dimensions.");
    }
  } catch {
    throw new Error("Uploaded file is not a valid JPG, PNG or WEBP image.");
  }
}

const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "AI request limit reached. Please try again later."
});

router.post("/describe", aiRateLimit, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Please upload a photograph." });
    }
    await validateImage(req.file.buffer);
    const description = await generateActivityDescription(req.file.buffer);
    return res.json({ success: true, description });
  } catch (error) {
    console.error("AI description error:", JSON.stringify({
      status: error.status,
      code: error.code,
      providerStatus: error.providerStatus,
      providerMessage: error.providerMessage,
      message: error.message,
      details: error.details
    }));
    const status = error.status === 429 ? 429 : error.status === 401 || error.status === 403 ? 502 : error.status === 504 ? 504 : 500;
    return res.status(status).json({
      success: false,
      message: status === 429
        ? "Gemini quota or rate limit exceeded. Please check the server Gemini account."
        : status === 502
          ? "Gemini authentication failed. Check the server API key and project access."
          : error.message || "Description generation failed."
    });
  }
});

router.post("/describe-batch", aiRateLimit, upload.array("images", 5), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ success: false, message: "Please upload photographs." });
    }
    const results = [];
    for (let i = 0; i < files.length; i += 2) {
      const batchResults = await Promise.all(files.slice(i, i + 2).map(async (file) => {
        try {
          await validateImage(file.buffer);
          return {
            success: true,
            originalName: file.originalname,
            description: await generateActivityDescription(file.buffer)
          };
        } catch (error) {
          return { success: false, originalName: file.originalname, message: error.message };
        }
      }));
      results.push(...batchResults);
    }
    return res.json({ success: true, total: results.length, results });
  } catch (error) {
    console.error("Batch processing error:", error.message);
    return res.status(500).json({ success: false, message: error.message || "Batch processing failed." });
  }
});

router.post("/validate-poc", pocUpload.single("pocImage"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Please upload a POC image." });
    await validateImage(req.file.buffer);
    return res.json({ success: true, message: "POC image validated." });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
