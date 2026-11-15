import { Document, HeadingLevel, ImageRun, Packer, PageBreak, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import PDFDocument from "pdfkit";
import pptxgen from "pptxgenjs";
import sharp from "sharp";

const IMAGE_FORMATS = ["jpeg", "png", "webp"];

class ReportValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ReportValidationError";
    this.statusCode = 400;
  }
}

function decodeImage(value, fieldName) {
  if (typeof value !== "string" || !value.startsWith("data:image/")) {
    throw new ReportValidationError(`${fieldName} must be a data URL image.`);
  }
  const match = value.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
  if (!match) throw new ReportValidationError(`${fieldName} must be a JPG, PNG or WEBP image.`);
  return Buffer.from(match[2], "base64");
}

async function validateImage(buffer, fieldName) {
  try {
    const metadata = await sharp(buffer).metadata();
    if (!IMAGE_FORMATS.includes(metadata.format) || !metadata.width || !metadata.height) {
      throw new ReportValidationError(`${fieldName} is not a valid JPG, PNG or WEBP image.`);
    }
  } catch (error) {
    if (error instanceof ReportValidationError) throw error;
    throw new ReportValidationError(`${fieldName} is not a valid JPG, PNG or WEBP image.`);
  }
}

function safeText(value, fallback = "") {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function validateReport(report) {
  if (!report || !Array.isArray(report.activities) || report.activities.length === 0) {
    throw new ReportValidationError("At least one activity is required.");
  }
  for (const [index, activity] of report.activities.entries()) {
    if (!activity.pocImage && !activity.pocImages?.length) throw new ReportValidationError(`Activity ${index + 1} is missing its POC image.`);
    if (!activity.photo && !activity.photos?.length) throw new ReportValidationError(`Activity ${index + 1} is missing its photograph.`);
  }
}

function imageValues(activity, pluralField, singularField) {
  const values = Array.isArray(activity[pluralField]) ? activity[pluralField] : [];
  return values.length ? values : activity[singularField] ? [activity[singularField]] : [];
}

async function prepareReport(input) {
  validateReport(input);
  const report = {
    ...input,
    collegeLogo: input.collegeLogo ? decodeImage(input.collegeLogo, "College logo") : null,
    collegeHeader: input.collegeHeader ? decodeImage(input.collegeHeader, "College header") : null,
    activities: []
  };
  if (report.collegeLogo) await validateImage(report.collegeLogo, "College logo");
  if (report.collegeHeader) {
    await validateImage(report.collegeHeader, "College header");
    const headerMetadata = await sharp(report.collegeHeader).metadata();
    const scale = Math.min(560 / headerMetadata.width, 130 / headerMetadata.height, 1);
    report.collegeHeaderSize = { width: Math.round(headerMetadata.width * scale), height: Math.round(headerMetadata.height * scale) };
  }
  for (const [index, activity] of input.activities.entries()) {
    const rawPhotos = imageValues(activity, "photos", "photo").map((value) => decodeImage(value, `Activity ${index + 1} photograph`));
    const rawPocImages = imageValues(activity, "pocImages", "pocImage").map((value) => decodeImage(value, `Activity ${index + 1} POC image`));
    for (const [imageIndex, image] of rawPhotos.entries()) await validateImage(image, `Activity ${index + 1} photograph ${imageIndex + 1}`);
    for (const [imageIndex, image] of rawPocImages.entries()) await validateImage(image, `Activity ${index + 1} POC image ${imageIndex + 1}`);
    const photos = await Promise.all(rawPhotos.map((image) => sharp(image).png().toBuffer()));
    const pocImages = await Promise.all(rawPocImages.map((image) => sharp(image).png().toBuffer()));
    const photoSizes = await Promise.all(photos.map(async (image) => {
      const metadata = await sharp(image).metadata();
      return { width: metadata.width, height: metadata.height };
    }));
    const pocImageSizes = await Promise.all(pocImages.map(async (image) => {
      const metadata = await sharp(image).metadata();
      return { width: metadata.width, height: metadata.height };
    }));
    report.activities.push({ ...activity, photo: photos[0], photos, photoSizes, pocImage: pocImages[0], pocImages, pocImageSizes });
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

function fitImageSize(size, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / size.width, maxHeight / size.height, 1);
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale))
  };
}

function totalSocialHours(activities) {
  return activities.reduce((sum, activity) => sum + (Number(activity.socialHours) || 0), 0);
}

const summaryColumnWidths = [700, 3600, 1100, 1100, 1700, 1600];
const summaryBorders = {
  top: { style: "single", size: 4, color: "D8DEE8" },
  bottom: { style: "single", size: 4, color: "D8DEE8" },
  left: { style: "single", size: 4, color: "D8DEE8" },
  right: { style: "single", size: 4, color: "D8DEE8" },
  insideHorizontal: { style: "single", size: 4, color: "D8DEE8" },
  insideVertical: { style: "single", size: 4, color: "D8DEE8" }
};

function summaryCell(text, width, options = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: options.header ? { fill: "EEF0FF" } : undefined,
    margins: { top: 110, bottom: 110, left: 110, right: 110 },
    verticalAlign: "center",
    borders: summaryBorders,
    children: [new Paragraph({
      alignment: options.align || "left",
      spacing: { before: 0, after: 0, line: 220 },
      children: [new TextRun({ text, bold: options.header, size: options.header ? 16 : 15, color: options.header ? "3E3A9A" : "263248", font: "Aptos" })]
    })]
  });
}

function summaryRow(values, header = false) {
  return new TableRow({
    cantSplit: true,
    children: values.map((value, index) => summaryCell(value, summaryColumnWidths[index], { header, align: index === 0 || index === 2 || index === 3 ? "center" : "left" }))
  });
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
  if (report.collegeHeader) children.push(new Paragraph({ alignment: "center", spacing: { after: 180 }, children: [docxImage(report.collegeHeader, report.collegeHeaderSize.width, report.collegeHeaderSize.height)] }));
  else if (report.collegeLogo) children.push(new Paragraph({ alignment: "center", children: [docxImage(report.collegeLogo, 130, 130)] }));
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
    width: { size: summaryColumnWidths.reduce((sum, width) => sum + width, 0), type: WidthType.DXA },
    layout: "fixed",
    borders: summaryBorders,
    rows: [
      summaryRow(["S.No.", "Activity Name", "Date", "Social Hours", "Participation", "Place"], true),
      ...report.activities.map((activity, index) => summaryRow([
        String(index + 1),
        safeText(activity.title, `Activity ${index + 1}`),
        safeText(activity.date, "Not specified"),
        safeText(activity.socialHours, "0"),
        safeText(activity.participationLevel, "Not specified"),
        safeText(activity.location, "Not specified")
      ]))
    ]
  }));
  children.push(new Paragraph({
    alignment: "left",
    spacing: { before: 180, after: 0 },
    children: [new TextRun({ text: `TOTAL SOCIAL SERVICE HOURS: ${totalSocialHours(report.activities)}`, bold: true, size: 15, color: "3E3A9A", font: "Aptos" })]
  }));
  children.push(new Paragraph({ children: [new PageBreak()] }));
  for (const [index, activity] of report.activities.entries()) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`Activity ${index + 1}: ${safeText(activity.title, "Untitled activity")}`)] }));
    children.push(new Paragraph(`Date: ${safeText(activity.date, "Not specified")}    Venue: ${safeText(activity.location, "Not specified")}`));
    children.push(new Paragraph({ spacing: { before: 180, after: 160 }, children: [new TextRun({ text: safeText(activity.description, "No description provided."), size: 24 })] }));
    for (const [photoIndex, photo] of activity.photos.entries()) {
      const size = fitImageSize(activity.photoSizes[photoIndex], 432, 576);
      children.push(new Paragraph({ alignment: "center", spacing: { before: photoIndex ? 140 : 0, after: 80 }, children: [docxImage(photo, size.width, size.height)] }));
    }
    children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: `Social service hours: ${safeText(activity.socialHours, "Not specified")}    Participation: ${safeText(activity.participationLevel, "Not specified")}`, size: 20 })] }));
    children.push(new Paragraph({ spacing: { before: 150 }, children: [new TextRun({ text: "POC documentary evidence", bold: true, size: 20 })] }));
    for (const [pocIndex, pocImage] of activity.pocImages.entries()) {
      const size = fitImageSize(activity.pocImageSizes[pocIndex], 560, 430);
      children.push(new Paragraph({ alignment: "center", spacing: { before: pocIndex ? 140 : 100, after: 80 }, children: [docxImage(pocImage, size.width, size.height)] }));
    }
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
  if (report.collegeHeader) doc.image(report.collegeHeader, 54, 54, { fit: [487, 115], align: "center" });
  else if (report.collegeLogo) doc.image(report.collegeLogo, 247, 58, { fit: [100, 100], align: "center" });
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
  drawPdfSummaryTable(doc, report.activities);
  for (const [index, activity] of report.activities.entries()) {
    doc.addPage();
    pdfText(doc, `Activity ${index + 1}: ${safeText(activity.title, "Untitled activity")}`, 18);
    doc.moveDown(.5);
    pdfText(doc, `Date: ${safeText(activity.date, "Not specified")}    Venue: ${safeText(activity.location, "Not specified")}`, 11);
    doc.moveDown(.5);
    pdfText(doc, safeText(activity.description, "No description provided."), 12);
    doc.moveDown(.8);
    for (const [photoIndex, photo] of activity.photos.entries()) {
      const size = fitImageSize(activity.photoSizes[photoIndex], 324, 432);
      if (doc.y + size.height > 735) doc.addPage();
      doc.image(photo, { fit: [size.width, size.height], align: "center" });
      doc.moveDown(.3);
    }
    pdfText(doc, `Social service hours: ${safeText(activity.socialHours, "Not specified")}    Participation: ${safeText(activity.participationLevel, "Not specified")}`, 11);
    doc.moveDown(.6);
    pdfText(doc, "POC documentary evidence", 12);
    for (const [pocIndex, pocImage] of activity.pocImages.entries()) {
      const size = fitImageSize(activity.pocImageSizes[pocIndex], 430, 390);
      if (doc.y + size.height > 735) doc.addPage();
      doc.image(pocImage, { fit: [size.width, size.height], align: "center" });
      doc.moveDown(.3);
    }
  }
  doc.end();
  return done;
}

function drawPdfSummaryTable(doc, activities) {
  const x = 54;
  const tableWidth = 487;
  const widths = [30, 180, 62, 58, 82, 75];
  const headers = ["S.No.", "Activity Name", "Date", "Social Hours", "Participation", "Place"];
  const bottom = 788;
  const drawHeader = () => {
    const y = doc.y;
    doc.rect(x, y, tableWidth, 28).fillAndStroke("#EEF0FF", "#D8DEE8");
    let offset = x;
    doc.font("Times-Bold").fontSize(8).fillColor("#3E3A9A");
    headers.forEach((header, index) => {
      doc.text(header, offset + 4, y + 9, { width: widths[index] - 8, align: index === 0 || index === 2 || index === 3 ? "center" : "left", lineBreak: false });
      offset += widths[index];
    });
    doc.y = y + 28;
  };
  const drawRow = (values) => {
    doc.font("Times-Roman").fontSize(8);
    const lineHeights = values.map((value, index) => doc.heightOfString(value, { width: widths[index] - 8, lineGap: 1 }));
    const height = Math.max(26, Math.ceil(Math.max(...lineHeights) + 12));
    if (doc.y + height > bottom) {
      doc.addPage();
      pdfText(doc, "PERFORMANCE SUMMARY (CONTINUED)", 14, { align: "center" });
      doc.moveDown(.5);
      drawHeader();
    }
    const y = doc.y;
    doc.rect(x, y, tableWidth, height).stroke("#D8DEE8");
    let offset = x;
    values.forEach((value, index) => {
      doc.font("Times-Roman").fontSize(8).fillColor("#263248").text(value, offset + 4, y + 6, {
        width: widths[index] - 8,
        height: height - 8,
        align: index === 0 || index === 2 || index === 3 ? "center" : "left",
        lineGap: 1
      });
      if (index < values.length - 1) doc.moveTo(offset + widths[index], y).lineTo(offset + widths[index], y + height).strokeColor("#D8DEE8").stroke();
      offset += widths[index];
    });
    doc.y = y + height;
  };
  drawHeader();
  activities.forEach((activity, index) => drawRow([
    String(index + 1),
    safeText(activity.title, `Activity ${index + 1}`),
    safeText(activity.date, "Not specified"),
    safeText(activity.socialHours, "0"),
    safeText(activity.participationLevel, "Not specified"),
    safeText(activity.location, "Not specified")
  ]));
  doc.moveDown(.5);
  doc.font("Times-Bold").fontSize(11).fillColor("#3E3A9A").text(`TOTAL SOCIAL SERVICE HOURS: ${totalSocialHours(activities)}`, x, doc.y, { width: tableWidth, align: "left", lineBreak: false });
}

export async function generatePptx(input) {
  const report = await prepareReport(input);
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE";
  const title = pptx.addSlide();
  title.background = { color: "F7F8FB" };
  if (report.collegeHeader) title.addImage({ data: `data:image/${imageType(report.collegeHeader)};base64,${report.collegeHeader.toString("base64")}`, x: (13.33 - report.collegeHeaderSize.width / 42) / 2, y: .35, w: report.collegeHeaderSize.width / 42, h: report.collegeHeaderSize.height / 42 });
  else if (report.collegeLogo) title.addImage({ data: `data:image/${imageType(report.collegeLogo)};base64,${report.collegeLogo.toString("base64")}`, x: 5.4, y: .35, w: 1.5, h: 1.5 });
  title.addText(safeText(report.collegeName, "College name"), { x: .6, y: report.collegeHeader ? 1.9 : 2, w: 12.1, h: .5, fontFace: "Aptos Display", bold: true, fontSize: 24, align: "center", color: "18202F" });
  title.addText("A REPORT ON SOCIAL SERVICE ACTIVITIES", { x: .6, y: report.collegeHeader ? 2.8 : 3, w: 12.1, h: .5, bold: true, fontSize: 22, align: "center", color: "635BFF" });
  title.addText(`${safeText(report.degree, "Bachelor of Technology")}\n${safeText(report.branch, "Not specified")}\nStudent: ${safeText(report.studentName, "Not specified")}`, { x: 2, y: report.collegeHeader ? 3.8 : 4, w: 9.3, h: 1.4, fontSize: 16, align: "center", color: "536078" });
  const summaryPageCount = Math.ceil(report.activities.length / 4);
  const index = pptx.addSlide();
  index.addText("INDEX", { x: .6, y: .4, w: 12, h: .4, fontSize: 22, bold: true, color: "18202F", align: "center" });
  report.activities.forEach((activity, i) => index.addText(`${i + 1}.  ${safeText(activity.title, `Activity ${i + 1}`)}    (Slide ${i + 3 + summaryPageCount})`, { x: 1.2, y: 1.1 + i * .45, w: 10.5, h: .3, fontSize: 14, color: "536078" }));
  const summaryHeaders = ["S.No.", "Activity Name", "Date", "Social Hours", "Participation", "Place"];
  const summaryRows = report.activities.map((activity, i) => [
    String(i + 1),
    safeText(activity.title, `Activity ${i + 1}`),
    safeText(activity.date, "Not specified"),
    safeText(activity.socialHours, "0"),
    safeText(activity.participationLevel, "Not specified"),
    safeText(activity.location, "Not specified")
  ]);
  for (let page = 0; page < summaryRows.length; page += 4) {
    const summary = pptx.addSlide();
    summary.addText(page ? "PERFORMANCE SUMMARY (CONTINUED)" : "PERFORMANCE SUMMARY", { x: .6, y: .35, w: 12, h: .4, fontSize: 22, bold: true, color: "18202F", align: "center" });
    const rows = [summaryHeaders, ...summaryRows.slice(page, page + 4)];
    summary.addTable(rows.map((row, rowIndex) => row.map((text, columnIndex) => ({
      text,
      options: { bold: rowIndex === 0, color: rowIndex === 0 ? "3E3A9A" : "263248", fill: rowIndex === 0 ? "EEF0FF" : "FFFFFF", valign: "mid", align: columnIndex === 0 || columnIndex === 2 || columnIndex === 3 ? "center" : "left" }
    }))), { x: .45, y: 1.05, w: 12.4, h: 5.3, colW: [0.65, 5.1, 1.05, 1.15, 2.15, 2.3], border: { type: "solid", pt: 1, color: "D8DEE8" }, fontFace: "Aptos", fontSize: 9, margin: .07, rowH: .95, valign: "mid", autoFit: false });
    if (page + 4 >= summaryRows.length) summary.addText(`TOTAL SOCIAL SERVICE HOURS: ${totalSocialHours(report.activities)}`, { x: .45, y: 6.55, w: 12.4, h: .3, fontSize: 15, bold: true, color: "3E3A9A", align: "left", fit: "shrink" });
  }
  for (const [indexNumber, activity] of report.activities.entries()) {
    for (let photoPage = 0; photoPage < activity.photos.length; photoPage += 1) {
      const slide = pptx.addSlide();
      slide.addText(`Activity ${indexNumber + 1}: ${safeText(activity.title, "Untitled activity")}`, { x: .5, y: .3, w: 12.3, h: .4, fontSize: 22, bold: true, color: "18202F" });
      slide.addText(`${safeText(activity.date, "Not specified")}  ·  ${safeText(activity.location, "Not specified")}`, { x: .5, y: .8, w: 12, h: .3, fontSize: 11, color: "758095" });
      if (photoPage === 0) slide.addText(safeText(activity.description, "No description provided."), { x: .5, y: 1.2, w: 3.4, h: 1.3, fontSize: 13, breakLine: false, color: "536078", valign: "top" });
      const photo = activity.photos[photoPage];
      const box = { x: (13.33 - 4.5) / 2, y: .95, w: 4.5, h: 6 };
      const size = fitImageSize(activity.photoSizes[photoPage], box.w * 96, box.h * 96);
      slide.addImage({ data: `data:image/${imageType(photo)};base64,${photo.toString("base64")}`, x: box.x + (box.w - size.width / 96) / 2, y: box.y + (box.h - size.height / 96) / 2, w: size.width / 96, h: size.height / 96 });
      slide.addText(`Hours: ${safeText(activity.socialHours, "Not specified")}  ·  POC: ${activity.pocImages.length} submitted`, { x: .5, y: 7.05, w: 12, h: .3, fontSize: 11, color: "21A576" });
    }
    for (let pocPage = 0; pocPage < activity.pocImages.length; pocPage += 4) {
      const slide = pptx.addSlide();
      slide.addText(`Activity ${indexNumber + 1}: POC evidence`, { x: .5, y: .3, w: 12.3, h: .4, fontSize: 20, bold: true, color: "18202F" });
      activity.pocImages.slice(pocPage, pocPage + 4).forEach((pocImage, imageIndex) => {
        const column = imageIndex % 2;
        const row = Math.floor(imageIndex / 2);
        const box = { x: .55 + column * 6.15, y: .95 + row * 2.7, w: 5.65, h: 2.45 };
        const size = fitImageSize(activity.pocImageSizes[pocPage + imageIndex], box.w * 96, box.h * 96);
        slide.addImage({ data: `data:image/${imageType(pocImage)};base64,${pocImage.toString("base64")}`, x: box.x + (box.w - size.width / 96) / 2, y: box.y + (box.h - size.height / 96) / 2, w: size.width / 96, h: size.height / 96 });
      });
    }
  }
  return pptx.write({ outputType: "nodebuffer" });
}
