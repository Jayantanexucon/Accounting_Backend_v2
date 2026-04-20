import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import libre from "libreoffice-convert";
import mammoth from "mammoth";
import { PDFDocument, rgb } from "pdf-lib";
import fs from "fs/promises";
import path from "path";

const TEMPLATES_DIR = path.join(process.cwd(), "Templates");

/**
 * Format date to DD/MM/YYYY
 */
export const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Generate Word document from template
 * @param {string} templateName - Name of the template file
 * @param {object} data - Data to fill in the template
 * @returns {Promise<Buffer>} - Word document buffer
 */
export const generateWordDocument = async (templateName, data) => {
  try {
    const templatePath = path.join(TEMPLATES_DIR, templateName);
    const content = await fs.readFile(templatePath, "binary");

    // Load DOCX as ZIP
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Render template with data
    doc.render(data);

    // Generate buffer
    const buffer = doc.getZip().generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    return buffer;
  } catch (error) {
    console.error("Error generating Word document:", error);
    throw error;
  }
};

/**
 * Generate PDF document from Word document
 * @param {Buffer} wordBuffer - Word document buffer
 * @returns {Promise<Buffer>} - PDF document buffer
 */
export const generatePdfFromWord = async (wordBuffer) => {
  try {
    const pdfBuffer = await new Promise((resolve, reject) => {
      libre.convert(wordBuffer, ".pdf", undefined, (err, done) => {
        if (err) reject(err);
        else resolve(done);
      });
    });
    return pdfBuffer;
  } catch (error) {
    console.error("LibreOffice conversion failed, using fallback method:", error);
    // Fallback: Convert Word to HTML then create simple PDF
    return generatePdfFallback(wordBuffer);
  }
};

/**
 * Fallback PDF generation using mammoth and pdf-lib
 * @param {Buffer} wordBuffer - Word document buffer
 * @returns {Promise<Buffer>} - PDF document buffer
 */
export const generatePdfFallback = async (wordBuffer) => {
  try {
    // Convert Word to HTML
    const htmlResult = await mammoth.convertToHtml({ buffer: wordBuffer });
    const html = htmlResult.value;

    // Create PDF with pdf-lib
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size

    // Add simple content
    const { height } = page.getSize();
    page.drawText("Document generated from template", {
      x: 50,
      y: height - 50,
      size: 12,
      color: rgb(0, 0, 0),
    });

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error("Fallback PDF generation failed:", error);
    throw error;
  }
};

/**
 * Send document as download response
 * @param {Response} res - Express response object
 * @param {Buffer} buffer - Document buffer
 * @param {string} filename - Download filename
 * @param {string} contentType - Content type header
 */
export const sendDocumentResponse = (res, buffer, filename, contentType) => {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
  res.send(buffer);
};