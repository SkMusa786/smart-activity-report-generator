import { Document, HeadingLevel, ImageRun, Packer, PageBreak, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import PDFDocument from "pdfkit";
import pptxgen from "pptxgenjs";
import sharp from "sharp";

const IMAGE_FORMATS = ["jpeg", "png", "webp"];

function decodeImage(value, fieldName) {
  if (typeof value !== "string" || !value.startsWith("data:image/")) {
    throw new Error(`${fieldName} must be a data URL image.`);
  }
  const match = value.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
  if (!match) throw new Error(`${fieldName} must be a JPG, PNG or WEBP image.`);
  return Buffer.from(match[2], "base64");
}

async function validateImage(buffer, fieldName) {
  const metadata = await sharp(buffer).metadata();
  if (!IMAGE_FORMATS.includes(metadata.format) || !metadata.width || !metadata.height) {
    throw new Error(`${fieldName} is not a valid JPG, PNG or WEBP image.`);
  }
}

function safeText(value, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function validateReport(report) {
  if (!report || !Array.isArray(report.activities) || report.activities.length === 0) {
    throw new Error("At least one activity is required.");
  }
  for (const [index, activity] of report.activities.entries()) {
    if (!activity.pocImage) throw new Error(`Activity ${index + 1} is missing its POC image.`);
    if (!activity.photo) throw new Error(`Activity ${index + 1} is missing its photograph.`);
  }
}

async function prepareReport(input) {
  validateReport(input);
  const report = {
    ...input,
    collegeLogo: input.collegeLogo ? decodeImage(input.collegeLogo, "College logo") : null,
    activities: []
  };
  if (report.collegeLogo) await validateImage(report.collegeLogo, "College logo");
  for (const [index, activity] of input.activities.entries()) {
    const rawPhoto = decodeImage(activity.photo, `Activity ${index + 1} photograph`);
    const rawPocImage = decodeImage(activity.pocImage, `Activity ${index + 1} POC image`);
    await validateImage(rawPhoto, `Activity ${index + 1} photograph`);
    await validateImage(rawPocImage, `Activity ${index + 1} POC image`);
    const photo = await sharp(rawPhoto).png().toBuffer();
    const pocImage = await sharp(rawPocImage).png().toBuffer();
    report.activities.push({ ...activity, photo, pocImage });
  }
  return report;
}

export async function persistReport(input) {
  await prepareReport(input);
  return { sessionOnly: true };
}

function pageNumberForActivity(index) {
  return index + 4;
}

function imageType(buffer) {
  return buffer[0] === 0xff && buffer[1] === 0xd8 ? "jpg" : "png";
}

function docxImage(buffer, width = 560, height = 315) {
  return new ImageRun({ data: buffer, transformation: { width, height }, type: "png" });
}

function coverParagraph(text, options = {}) {
  return new Paragraph({
    alignment: "center",
    spacing: { after: options.after || 180 },
    children: [new TextRun({ text, bold: options.bold, size: options.size || 24, font: "Times New Roman" })]
  });
}

export async function generateDocx(input) {
  const report = await prepareReport(input);
  const children = [];
  if (report.collegeLogo) children.push(new Paragraph({ alignment: "center", children: [docxImage(report.collegeLogo, 130, 130)] }));
  children.push(coverParagraph(safeText(report.collegeName, "College name"), { bold: true, size: 28 }));
  children.push(coverParagraph(safeText(report.collegeAddress), { size: 18 }));
  children.push(coverParagraph(safeText(report.collegeStatus), { size: 18 }));
  children.push(new Paragraph({ spacing: { before: 650, after: 250 }, alignment: "center", children: [new TextRun({ text: "A REPORT ON SOCIAL SERVICE ACTIVITIES", bold: true, size: 28, font: "Times New Roman" })] }));
  children.push(coverParagraph("Submitted in partial fulfilment for the award of the degree", { size: 18 }));
  children.push(coverParagraph(safeText(report.degree, "Bachelor of Technology"), { bold: true, size: 22 }));
  children.push(coverParagraph(`Branch / Department: ${safeText(report.branch, "Not specified")}`, { size: 18 }));
  children.push(new Paragraph({ spacing: { before: 550 }, alignment: "center", children: [new TextRun({ text: `Student: ${safeText(report.studentName, "Not specified")}\nRoll number: ${safeText(report.rollNumber, "Not specified")}\nAcademic batch: ${safeText(report.academicBatch, "Not specified")}`, size: 18, font: "Times New Roman" })] }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  children.push(coverParagraph("INDEX", { bold: true, size: 24 }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: ["S.NO", "CONTENT / ACTIVITY NAME", "PAGE NUMBER"].map((text) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })) }),
      ...report.activities.map((activity, index) => new TableRow({ children: [
        new TableCell({ children: [new Paragraph(`${index + 1}`)] }),
        new TableCell({ children: [new Paragraph(safeText(activity.title, `Activity ${index + 1}`))] }),
        new TableCell({ children: [new Paragraph(`${pageNumberForActivity(index)}`)] })
      ] }))
    ]
  }));
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(coverParagraph("PERFORMANCE SUMMARY", { bold: true, size: 22 }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: ["S.No.", "Activity Description", "Date", "Social Hours", "Participation", "Place"].map((text) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 18 })] })] })) }),
      ...report.activities.map((activity, index) => new TableRow({ children: [
        new TableCell({ children: [new Paragraph(`${index + 1}`)] }),
        new TableCell({ children: [new Paragraph(safeText(activity.title, `Activity ${index + 1}`))] }),
        new TableCell({ children: [new Paragraph(safeText(activity.date))] }),
        new TableCell({ children: [new Paragraph(safeText(activity.socialHours))] }),
        new TableCell({ children: [new Paragraph(safeText(activity.participationLevel))] }),
        new TableCell({ children: [new Paragraph(safeText(activity.location))] })
      ] })),
      new TableRow({ children: [new TableCell({ columnSpan: 3, children: [new Paragraph("Total social service hours")] }), new TableCell({ children: [new Paragraph(String(report.activities.reduce((sum, activity) => sum + (Number(activity.socialHours) || 0), 0)))] }), new TableCell({ columnSpan: 2, children: [new Paragraph("")] })] })
    ]
  }));
  children.push(new Paragraph({ children: [new PageBreak()] }));
  for (const [index, activity] of report.activities.entries()) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`Activity ${index + 1}: ${safeText(activity.title, "Untitled activity")}`)] }));
    children.push(new Paragraph(`Date: ${safeText(activity.date, "Not specified")}    Venue: ${safeText(activity.location, "Not specified")}`));
    children.push(new Paragraph({ spacing: { before: 180, after: 160 }, children: [new TextRun({ text: safeText(activity.description, "No description provided."), size: 24 })] }));
    children.push(new Paragraph({ children: [docxImage(activity.photo)] }));
    children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: `Social service hours: ${safeText(activity.socialHours, "Not specified")}    Participation: ${safeText(activity.participationLevel, "Not specified")}`, size: 20 })] }));
    children.push(new Paragraph({ spacing: { before: 150 }, children: [new TextRun({ text: "POC documentary evidence", bold: true, size: 20 })] }));
    children.push(new Paragraph({ children: [docxImage(activity.pocImage, 400, 250)] }));
    if (index < report.activities.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }));
  }
  return Packer.toBuffer(new Document({ sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }] }));
}

function pdfText(doc, text, size = 14, options = {}) {
  doc.font("Times-Roman").fontSize(size).text(text, { align: options.align || "left", continued: false });
}

export async function generatePdf(input) {
  const report = await prepareReport(input);
  const doc = new PDFDocument({ size: "A4", margin: 54, autoFirstPage: true });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  if (report.collegeLogo) doc.image(report.collegeLogo, 247, 58, { fit: [100, 100], align: "center" });
  doc.y = 185;
  pdfText(doc, safeText(report.collegeName, "College name"), 22, { align: "center" });
  pdfText(doc, safeText(report.collegeAddress), 13, { align: "center" });
  pdfText(doc, safeText(report.collegeStatus), 13, { align: "center" });
  doc.moveDown(3);
  pdfText(doc, "A REPORT ON SOCIAL SERVICE ACTIVITIES", 20, { align: "center" });
  doc.moveDown();
  pdfText(doc, "Submitted in partial fulfilment for the award of the degree", 13, { align: "center" });
  doc.moveDown(.5);
  pdfText(doc, safeText(report.degree, "Bachelor of Technology"), 16, { align: "center" });
  pdfText(doc, `Branch / Department: ${safeText(report.branch, "Not specified")}`, 13, { align: "center" });
  doc.moveDown(3);
  pdfText(doc, `Student: ${safeText(report.studentName, "Not specified")}\nRoll number: ${safeText(report.rollNumber, "Not specified")}\nAcademic batch: ${safeText(report.academicBatch, "Not specified")}`, 13, { align: "center" });
  doc.addPage();
  pdfText(doc, "INDEX", 20, { align: "center" });
  doc.moveDown();
  const tableTop = doc.y;
  doc.fontSize(11).font("Times-Bold").text("S.NO", 70, tableTop, { width: 45 });
  doc.text("CONTENT / ACTIVITY NAME", 130, tableTop, { width: 280 });
  doc.text("PAGE NUMBER", 420, tableTop, { width: 90 });
  doc.moveTo(60, tableTop - 5).lineTo(535, tableTop - 5).stroke();
  doc.font("Times-Roman");
  report.activities.forEach((activity, index) => {
    const y = tableTop + 28 + index * 25;
    doc.text(String(index + 1), 70, y, { width: 45 });
    doc.text(safeText(activity.title, `Activity ${index + 1}`), 130, y, { width: 280 });
    doc.text(String(pageNumberForActivity(index)), 420, y, { width: 90 });
  });
  doc.addPage();
  pdfText(doc, "PERFORMANCE SUMMARY", 18, { align: "center" });
  doc.moveDown();
  const summaryTop = doc.y;
  pdfText(doc, "S.No.   Activity Description                         Date       Social Hours   Participation   Place", 9);
  doc.moveTo(60, summaryTop - 4).lineTo(535, summaryTop - 4).stroke();
  report.activities.forEach((activity, index) => {
    pdfText(doc, `${index + 1}.       ${safeText(activity.title, `Activity ${index + 1}`)}   ${safeText(activity.date)}   ${safeText(activity.socialHours)}   ${safeText(activity.participationLevel)}   ${safeText(activity.location)}`, 8);
  });
  pdfText(doc, `Total social service hours: ${report.activities.reduce((sum, activity) => sum + (Number(activity.socialHours) || 0), 0)}`, 10);
  for (const [index, activity] of report.activities.entries()) {
    doc.addPage();
    pdfText(doc, `Activity ${index + 1}: ${safeText(activity.title, "Untitled activity")}`, 18);
    doc.moveDown(.5);
    pdfText(doc, `Date: ${safeText(activity.date, "Not specified")}    Venue: ${safeText(activity.location, "Not specified")}`, 11);
    doc.moveDown(.5);
    pdfText(doc, safeText(activity.description, "No description provided."), 12);
    doc.moveDown(.8);
    doc.image(activity.photo, { fit: [480, 270], align: "center" });
    doc.moveDown(.5);
    pdfText(doc, `Social service hours: ${safeText(activity.socialHours, "Not specified")}    Participation: ${safeText(activity.participationLevel, "Not specified")}`, 11);
    doc.moveDown(.6);
    pdfText(doc, "POC documentary evidence", 12);
    doc.image(activity.pocImage, { fit: [360, 220], align: "center" });
  }
  doc.end();
  return done;
}

export async function generatePptx(input) {
  const report = await prepareReport(input);
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  const title = pptx.addSlide();
  title.background = { color: "F7F8FB" };
  if (report.collegeLogo) title.addImage({ data: `data:image/${imageType(report.collegeLogo)};base64,${report.collegeLogo.toString("base64")}`, x: 5.4, y: .35, w: 1.5, h: 1.5 });
  title.addText(safeText(report.collegeName, "College name"), { x: .6, y: 2, w: 12.1, h: .5, fontFace: "Aptos Display", bold: true, fontSize: 24, align: "center", color: "18202F" });
  title.addText("A REPORT ON SOCIAL SERVICE ACTIVITIES", { x: .6, y: 3, w: 12.1, h: .5, bold: true, fontSize: 22, align: "center", color: "635BFF" });
  title.addText(`${safeText(report.degree, "Bachelor of Technology")}\n${safeText(report.branch, "Not specified")}\nStudent: ${safeText(report.studentName, "Not specified")}`, { x: 2, y: 4, w: 9.3, h: 1.4, fontSize: 16, align: "center", color: "536078" });
  const index = pptx.addSlide();
  index.addText("INDEX", { x: .6, y: .4, w: 12, h: .4, fontSize: 22, bold: true, color: "18202F", align: "center" });
  report.activities.forEach((activity, i) => index.addText(`${i + 1}.  ${safeText(activity.title, `Activity ${i + 1}`)}    (Slide ${i + 4})`, { x: 1.2, y: 1.1 + i * .45, w: 10.5, h: .3, fontSize: 14, color: "536078" }));
  const summary = pptx.addSlide();
  summary.addText("PERFORMANCE SUMMARY", { x: .6, y: .4, w: 12, h: .4, fontSize: 22, bold: true, color: "18202F", align: "center" });
  summary.addText(report.activities.map((activity, i) => `${i + 1}. ${safeText(activity.title, `Activity ${i + 1}`)} | ${safeText(activity.date)} | ${safeText(activity.socialHours)} hours | ${safeText(activity.participationLevel)} | ${safeText(activity.location)}`).join("\n"), { x: .8, y: 1.1, w: 11.6, h: 4.8, fontSize: 13, color: "536078", breakLine: false, valign: "top" });
  for (const [indexNumber, activity] of report.activities.entries()) {
    const slide = pptx.addSlide();
    slide.addText(`Activity ${indexNumber + 1}: ${safeText(activity.title, "Untitled activity")}`, { x: .5, y: .3, w: 12.3, h: .4, fontSize: 22, bold: true, color: "18202F" });
    slide.addText(`${safeText(activity.date, "Not specified")}  ·  ${safeText(activity.location, "Not specified")}`, { x: .5, y: .8, w: 12, h: .3, fontSize: 11, color: "758095" });
    slide.addText(safeText(activity.description, "No description provided."), { x: .5, y: 1.2, w: 4.1, h: 1.3, fontSize: 13, breakLine: false, color: "536078", valign: "top" });
    slide.addImage({ data: `data:image/${imageType(activity.photo)};base64,${activity.photo.toString("base64")}`, x: 4.9, y: 1.2, w: 7.7, h: 4.3 });
    slide.addText(`Hours: ${safeText(activity.socialHours, "Not specified")}  ·  POC: Submitted`, { x: .5, y: 6.2, w: 12, h: .3, fontSize: 11, color: "21A576" });
  }
  return pptx.write({ outputType: "nodebuffer" });
}
