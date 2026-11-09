import express from "express";
import { generateDocx, generatePdf, generatePptx, persistReport } from "../services/reportService.js";
import { rateLimit } from "../middleware/security.js";

const router = express.Router();
const reportRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Report request limit reached. Please try again later."
});

async function generate(res, report, format) {
  try {
    const generators = { docx: generateDocx, pdf: generatePdf, pptx: generatePptx };
    const buffer = await generators[format](report);
    const contentTypes = {
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pdf: "application/pdf",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    };
    res.set({
      "Content-Type": contentTypes[format],
      "Content-Disposition": `attachment; filename="social-service-activity-report.${format}"`
    });
    res.send(buffer);
  } catch (error) {
    console.error(`${format.toUpperCase()} report generation error:`, error);
    res.status(400).json({ success: false, message: error.message || "Report generation failed." });
  }
}

router.post("/submit", reportRateLimit, async (req, res) => {
  try {
    const result = await persistReport(req.body);
    return res.status(200).json({ success: true, message: "Report validated for this session.", sessionOnly: result.sessionOnly });
  } catch (error) {
    console.error("Report submission error:", error.message);
    return res.status(400).json({ success: false, message: error.message || "Report submission failed." });
  }
});

router.post("/generate/docx", reportRateLimit, (req, res) => generate(res, req.body, "docx"));
router.post("/generate/pdf", reportRateLimit, (req, res) => generate(res, req.body, "pdf"));
router.post("/generate/pptx", reportRateLimit, (req, res) => generate(res, req.body, "pptx"));

export default router;
