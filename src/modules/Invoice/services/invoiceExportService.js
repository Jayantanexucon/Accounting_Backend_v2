import PDFDocument from "pdfkit";
import { createWriteStream, mkdirSync } from "fs";
import { join } from "path";
import AppError from "../../../utils/AppError.js";

/**
 * Generate PDF export of invoice
 * @param {Object} invoice - Invoice data
 * @param {string} filePath - Output file path
 * @returns {Promise<string>} Path to generated PDF
 */
export const generateInvoicePDF = async (invoice, filePath) => {
  try {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ bufferPages: true });
      const writeStream = createWriteStream(filePath);

      doc.pipe(writeStream);

      // Header
      doc.fontSize(20).font("Helvetica-Bold").text("INVOICE", { align: "center" });
      doc.moveDown(0.5);

      // Invoice Info
      doc.fontSize(10).font("Helvetica");
      doc.text(`Invoice No: ${invoice.invoiceNo}`);
      doc.text(`Invoice Date: ${new Date(invoice.invoiceDate).toLocaleDateString()}`);
      doc.text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString()}`);
      doc.moveDown(1);

      // Bill To
      doc.font("Helvetica-Bold").text("Bill To:");
      doc.font("Helvetica");
      if (invoice.billTo) {
        doc.text(invoice.billTo.name);
        if (invoice.billTo.address) doc.text(invoice.billTo.address);
        if (invoice.billTo.stateCode) doc.text(`State: ${invoice.billTo.stateCode}`);
        if (invoice.billTo.gstin) doc.text(`GSTIN: ${invoice.billTo.gstin}`);
      }
      doc.moveDown(0.5);

      // Ship To
      doc.font("Helvetica-Bold").text("Ship To:");
      doc.font("Helvetica");
      if (invoice.shipTo) {
        doc.text(invoice.shipTo.name);
        if (invoice.shipTo.address) doc.text(invoice.shipTo.address);
      }
      doc.moveDown(1);

      // Line Items Table
      doc.font("Helvetica-Bold").fontSize(11);
      const tableTop = doc.y;
      const itemsX = 50;
      const colWidths = {
        description: 200,
        quantity: 80,
        rate: 80,
        amount: 80,
      };

      // Table Headers
      doc.text("Description", itemsX, tableTop);
      doc.text("Qty", itemsX + colWidths.description);
      doc.text("Rate", itemsX + colWidths.description + colWidths.quantity);
      doc.text("Amount", itemsX + colWidths.description + colWidths.quantity + colWidths.rate);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      // Table Data
      doc.font("Helvetica").fontSize(9);
      if (invoice.items && invoice.items.length > 0) {
        invoice.items.forEach((item) => {
          const description = item.description || "";
          const quantity = item.quantity || 0;
          const rate = item.rate || 0;
          const amount = item.totalAmount || 0;

          doc.text(description.substring(0, 40), itemsX, doc.y);
          doc.text(quantity.toString(), itemsX + colWidths.description, doc.y - doc.currentLineHeight());
          doc.text(rate.toFixed(2), itemsX + colWidths.description + colWidths.quantity, doc.y - doc.currentLineHeight());
          doc.text(amount.toFixed(2), itemsX + colWidths.description + colWidths.quantity + colWidths.rate, doc.y - doc.currentLineHeight());
          doc.moveDown(1);
        });
      }

      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);

      // Totals
      const totalsX = 350;
      doc.font("Helvetica-Bold").fontSize(10);
      doc.text("Subtotal:", totalsX, doc.y);
      doc.text((invoice.totalTaxableValue || 0).toFixed(2), totalsX + 150);
      doc.moveDown(0.5);

      if ((invoice.totalCGSTAmount || 0) > 0) {
        doc.text("CGST:", totalsX);
        doc.text((invoice.totalCGSTAmount || 0).toFixed(2), totalsX + 150);
        doc.moveDown(0.5);
      }

      if ((invoice.totalSGSTAmount || 0) > 0) {
        doc.text("SGST:", totalsX);
        doc.text((invoice.totalSGSTAmount || 0).toFixed(2), totalsX + 150);
        doc.moveDown(0.5);
      }

      if ((invoice.totalIGSTAmount || 0) > 0) {
        doc.text("IGST:", totalsX);
        doc.text((invoice.totalIGSTAmount || 0).toFixed(2), totalsX + 150);
        doc.moveDown(0.5);
      }

      doc.fontSize(11);
      doc.text("Total:", totalsX);
      doc.text((invoice.invoiceAmount || 0).toFixed(2), totalsX + 150);

      if ((invoice.tdsAmount || 0) > 0) {
        doc.moveDown(0.5);
        doc.text("TDS:", totalsX);
        doc.text((invoice.tdsAmount || 0).toFixed(2), totalsX + 150);
        doc.moveDown(0.5);
        doc.text("Net Payable:", totalsX);
        doc.text((invoice.netPayable || 0).toFixed(2), totalsX + 150);
      }

      // Footer
      doc.moveDown(2);
      doc.fontSize(8).text("This is a computer-generated document. No signature is required.", { align: "center" });

      writeStream.on("finish", () => {
        resolve(filePath);
      });

      writeStream.on("error", (error) => {
        reject(new AppError(`PDF generation failed: ${error.message}`, 500, "generateInvoicePDF"));
      });

      doc.end();
    });
  } catch (error) {
    throw new AppError(error.message, 500, "generateInvoicePDF");
  }
};

/**
 * Generate Word document export of invoice
 * Using HTML template converted to Word
 * @param {Object} invoice - Invoice data
 * @param {string} filePath - Output file path
 * @returns {Promise<string>} Path to generated Word document
 */
export const generateInvoiceWord = async (invoice, filePath) => {
  try {
    // Create HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 20px; }
          .invoice-info { margin-bottom: 20px; }
          .info-row { margin: 5px 0; }
          .parties { display: flex; gap: 40px; margin: 20px 0; }
          .party { flex: 1; }
          .party-title { font-weight: bold; margin-bottom: 10px; }
          .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .items-table th, .items-table td { border: 1px solid #ccc; padding: 10px; text-align: left; }
          .items-table th { background-color: #f0f0f0; font-weight: bold; }
          .totals { margin-left: auto; width: 300px; margin-top: 20px; }
          .total-row { display: flex; justify-content: space-between; margin: 5px 0; }
          .total-amount { font-weight: bold; font-size: 14px; }
          .footer { text-align: center; font-size: 10px; margin-top: 40px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">INVOICE</div>
        
        <div class="invoice-info">
          <div class="info-row"><strong>Invoice No:</strong> ${invoice.invoiceNo}</div>
          <div class="info-row"><strong>Invoice Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString()}</div>
          <div class="info-row"><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</div>
          ${invoice.poNumber ? `<div class="info-row"><strong>PO No:</strong> ${invoice.poNumber}</div>` : ""}
        </div>

        <div class="parties">
          <div class="party">
            <div class="party-title">Bill To:</div>
            <div>${invoice.billTo?.name || ""}</div>
            ${invoice.billTo?.address ? `<div>${invoice.billTo.address}</div>` : ""}
            ${invoice.billTo?.stateCode ? `<div>State: ${invoice.billTo.stateCode}</div>` : ""}
            ${invoice.billTo?.gstin ? `<div>GSTIN: ${invoice.billTo.gstin}</div>` : ""}
          </div>
          
          <div class="party">
            <div class="party-title">Ship To:</div>
            <div>${invoice.shipTo?.name || ""}</div>
            ${invoice.shipTo?.address ? `<div>${invoice.shipTo.address}</div>` : ""}
            ${invoice.shipTo?.stateCode ? `<div>State: ${invoice.shipTo.stateCode}</div>` : ""}
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th style="text-align: right;">Quantity</th>
              <th style="text-align: right;">Rate</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${
              invoice.items?.map((item) => `
            <tr>
              <td>${item.description}</td>
              <td style="text-align: right;">${item.quantity}</td>
              <td style="text-align: right;">₹ ${item.rate.toFixed(2)}</td>
              <td style="text-align: right;">₹ ${item.totalAmount.toFixed(2)}</td>
            </tr>
            `).join("") || ""
            }
          </tbody>
        </table>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>₹ ${(invoice.totalTaxableValue || 0).toFixed(2)}</span>
          </div>
          ${
            (invoice.totalCGSTAmount || 0) > 0
              ? `<div class="total-row">
            <span>CGST:</span>
            <span>₹ ${(invoice.totalCGSTAmount || 0).toFixed(2)}</span>
          </div>`
              : ""
          }
          ${
            (invoice.totalSGSTAmount || 0) > 0
              ? `<div class="total-row">
            <span>SGST:</span>
            <span>₹ ${(invoice.totalSGSTAmount || 0).toFixed(2)}</span>
          </div>`
              : ""
          }
          ${
            (invoice.totalIGSTAmount || 0) > 0
              ? `<div class="total-row">
            <span>IGST:</span>
            <span>₹ ${(invoice.totalIGSTAmount || 0).toFixed(2)}</span>
          </div>`
              : ""
          }
          <div class="total-row total-amount">
            <span>Total:</span>
            <span>₹ ${(invoice.invoiceAmount || 0).toFixed(2)}</span>
          </div>
          ${
            (invoice.tdsAmount || 0) > 0
              ? `
          <div class="total-row">
            <span>TDS:</span>
            <span>₹ ${(invoice.tdsAmount || 0).toFixed(2)}</span>
          </div>
          <div class="total-row total-amount">
            <span>Net Payable:</span>
            <span>₹ ${(invoice.netPayable || 0).toFixed(2)}</span>
          </div>
          `
              : ""
          }
        </div>

        <div class="footer">
          This is a computer-generated document. No signature is required.
        </div>
      </body>
      </html>
    `;

    // Write HTML to file (converted to .docx by the application layer)
    // For now, save as HTML with .docx extension for compatibility
    const { writeFileSync } = await import("fs");
    writeFileSync(filePath, htmlContent, "utf-8");

    return filePath;
  } catch (error) {
    throw new AppError(error.message, 500, "generateInvoiceWord");
  }
};

/**
 * Export invoice in multiple formats
 * @param {Object} invoice - Invoice data
 * @param {string} format - Export format (pdf, word, both)
 * @param {string} outputDir - Output directory
 * @returns {Promise<Object>} Paths to generated files
 */
export const exportInvoice = async (invoice, format = "pdf", outputDir = "./uploads/exports") => {
  try {
    // Ensure output directory exists
    mkdirSync(outputDir, { recursive: true });

    const baseFileName = `INV-${invoice.invoiceNo}-${Date.now()}`;
    const results = {};

    if (format === "pdf" || format === "both") {
      const pdfPath = join(outputDir, `${baseFileName}.pdf`);
      results.pdfPath = await generateInvoicePDF(invoice, pdfPath);
      results.pdfFileName = `${baseFileName}.pdf`;
    }

    if (format === "word" || format === "both") {
      const wordPath = join(outputDir, `${baseFileName}.docx`);
      results.wordPath = await generateInvoiceWord(invoice, wordPath);
      results.wordFileName = `${baseFileName}.docx`;
    }

    return {
      success: true,
      message: `Invoice exported as ${format}`,
      files: results,
    };
  } catch (error) {
    if (error.statusCode) throw error;
    throw new AppError(error.message, 500, "exportInvoice");
  }
};

/**
 * Generate invoice list export (CSV/PDF)
 * @param {Array} invoices - Array of invoice objects
 * @param {string} format - Export format (csv, pdf)
 * @param {string} outputDir - Output directory
 * @returns {Promise<string>} Path to generated file
 */
export const exportInvoiceList = async (invoices, format = "csv", outputDir = "./uploads/exports") => {
  try {
    mkdirSync(outputDir, { recursive: true });

    if (format === "csv") {
      const headers = [
        "Invoice No",
        "Invoice Date",
        "Bill To",
        "Amount",
        "Status",
        "Amount Due",
      ];
      const rows = invoices.map((inv) => [
        inv.invoiceNo,
        new Date(inv.invoiceDate).toLocaleDateString(),
        inv.billTo?.name || "",
        inv.invoiceAmount,
        inv.status,
        inv.amountDue,
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n");

      const { writeFileSync } = await import("fs");
      const fileName = `Invoice-List-${Date.now()}.csv`;
      const filePath = join(outputDir, fileName);
      writeFileSync(filePath, csvContent, "utf-8");

      return {
        success: true,
        message: "Invoice list exported as CSV",
        filePath,
        fileName,
      };
    }

    throw new AppError("Format not supported", 400, "exportInvoiceList");
  } catch (error) {
    if (error.statusCode) throw error;
    throw new AppError(error.message, 500, "exportInvoiceList");
  }
};
