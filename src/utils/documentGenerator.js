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
    console.error("LibreOffice conversion failed. LibreOffice is likely not installed on the system path.", error);
    throw new Error("PDF conversion failed: LibreOffice is required on the server to generate PDFs from Word templates.");
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