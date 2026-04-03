import nodemailer from "nodemailer";
import AppError from "../../../utils/AppError.js";

let transporter = null;

/**
 * Initialize email transporter
 * @param {Object} config - Email configuration
 * @returns {void}
 */
export const initializeEmailTransporter = (config) => {
  try {
    if (config.service === "gmail") {
      transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: config.email || process.env.EMAIL_USER,
          pass: config.password || process.env.EMAIL_PASSWORD,
        },
      });
    } else if (config.host && config.port) {
      transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure || false,
        auth: {
          user: config.user || process.env.EMAIL_USER,
          pass: config.password || process.env.EMAIL_PASSWORD,
        },
      });
    } else {
      console.warn("Email configuration incomplete. Email notifications may not work.");
      transporter = null;
    }
  } catch (error) {
    console.error("Error initializing email transporter:", error.message);
    transporter = null;
  }
};

/**
 * Send invoice created notification
 * @param {Object} invoice - Invoice data
 * @param {string} recipientEmail - Email recipient
 * @returns {Promise<void>}
 */
export const sendInvoiceCreatedNotification = async (invoice, recipientEmail) => {
  try {
    if (!transporter) {
      console.warn("Email transporter not initialized. Skipping invoice creation notification.");
      return;
    }

    if (!recipientEmail) {
      console.warn("Recipient email not provided. Skipping notification.");
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .invoice-info { background-color: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid #4CAF50; }
            .invoice-info p { margin: 5px 0; }
            .footer { font-size: 12px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
            .button { background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Invoice Created Successfully</h1>
          </div>
          
          <div class="content">
            <p>Dear Recipient,</p>
            <p>A new invoice has been created. Here are the details:</p>
            
            <div class="invoice-info">
              <p><strong>Invoice Number:</strong> ${invoice.invoiceNo}</p>
              <p><strong>Invoice Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString()}</p>
              <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
              <p><strong>Invoice Amount:</strong> ₹${(invoice.invoiceAmount || 0).toFixed(2)}</p>
              <p><strong>Bill To:</strong> ${invoice.billTo?.name || "N/A"}</p>
              ${invoice.poNumber ? `<p><strong>PO Number:</strong> ${invoice.poNumber}</p>` : ""}
            </div>
            
            <p>Please review the invoice and take appropriate action.</p>
            
            <p>Best regards,<br/>
            Accounting Team</p>
          </div>
          
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;

    await transporter.sendMail({
      from: process.env.EMAIL_USER || "accounting@company.com",
      to: recipientEmail,
      subject: `Invoice Created: ${invoice.invoiceNo}`,
      html: htmlContent,
    });

    console.log(`Invoice creation notification sent to ${recipientEmail}`);
  } catch (error) {
    console.error("Error sending invoice created notification:", error.message);
    // Don't throw - fail open principle
  }
};

/**
 * Send invoice approval notification
 * @param {Object} invoice - Invoice data
 * @param {Array<string>} recipientEmails - Array of recipient emails
 * @returns {Promise<void>}
 */
export const sendInvoiceApprovedNotification = async (invoice, recipientEmails) => {
  try {
    if (!transporter) {
      console.warn("Email transporter not initialized. Skipping invoice approval notification.");
      return;
    }

    if (!recipientEmails || recipientEmails.length === 0) {
      console.warn("Recipient emails not provided. Skipping notification.");
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .invoice-info { background-color: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid #2196F3; }
            .invoice-info p { margin: 5px 0; }
            .footer { font-size: 12px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
            .status { color: #4CAF50; font-weight: bold; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Invoice Approved</h1>
          </div>
          
          <div class="content">
            <p>Dear Recipient,</p>
            <p>An invoice has been approved. Details are as follows:</p>
            
            <div class="invoice-info">
              <p><strong>Invoice Number:</strong> ${invoice.invoiceNo}</p>
              <p><strong>Status:</strong> <span class="status">APPROVED</span></p>
              <p><strong>Invoice Amount:</strong> ₹${(invoice.invoiceAmount || 0).toFixed(2)}</p>
              <p><strong>Bill To:</strong> ${invoice.billTo?.name || "N/A"}</p>
              ${invoice.approvalComments ? `<p><strong>Approval Comments:</strong> ${invoice.approvalComments}</p>` : ""}
            </div>
            
            <p>The invoice is now ready for payment processing.</p>
            
            <p>Best regards,<br/>
            Accounting Team</p>
          </div>
          
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;

    for (const email of recipientEmails) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER || "accounting@company.com",
        to: email,
        subject: `Invoice Approved: ${invoice.invoiceNo}`,
        html: htmlContent,
      });
    }

    console.log(`Invoice approval notification sent to ${recipientEmails.length} recipients`);
  } catch (error) {
    console.error("Error sending invoice approval notification:", error.message);
    // Don't throw - fail open principle
  }
};

/**
 * Send invoice rejection notification
 * @param {Object} invoice - Invoice data
 * @param {Array<string>} recipientEmails - Array of recipient emails
 * @param {string} rejectionReason - Reason for rejection
 * @returns {Promise<void>}
 */
export const sendInvoiceRejectedNotification = async (invoice, recipientEmails, rejectionReason) => {
  try {
    if (!transporter) {
      console.warn("Email transporter not initialized. Skipping invoice rejection notification.");
      return;
    }

    if (!recipientEmails || recipientEmails.length === 0) {
      console.warn("Recipient emails not provided. Skipping notification.");
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .header { background-color: #F44336; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .invoice-info { background-color: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid #F44336; }
            .invoice-info p { margin: 5px 0; }
            .footer { font-size: 12px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
            .status { color: #F44336; font-weight: bold; font-size: 16px; }
            .reason { background-color: #fff3cd; padding: 10px; border-radius: 4px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Invoice Rejected</h1>
          </div>
          
          <div class="content">
            <p>Dear Recipient,</p>
            <p>An invoice has been rejected. Details are as follows:</p>
            
            <div class="invoice-info">
              <p><strong>Invoice Number:</strong> ${invoice.invoiceNo}</p>
              <p><strong>Status:</strong> <span class="status">REJECTED</span></p>
              <p><strong>Invoice Amount:</strong> ₹${(invoice.invoiceAmount || 0).toFixed(2)}</p>
              <p><strong>Bill To:</strong> ${invoice.billTo?.name || "N/A"}</p>
            </div>
            
            ${
              rejectionReason
                ? `<div class="reason">
              <p><strong>Reason for Rejection:</strong></p>
              <p>${rejectionReason}</p>
            </div>`
                : ""
            }
            
            <p>Please review the comments and resubmit if needed.</p>
            
            <p>Best regards,<br/>
            Accounting Team</p>
          </div>
          
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;

    for (const email of recipientEmails) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER || "accounting@company.com",
        to: email,
        subject: `Invoice Rejected: ${invoice.invoiceNo}`,
        html: htmlContent,
      });
    }

    console.log(`Invoice rejection notification sent to ${recipientEmails.length} recipients`);
  } catch (error) {
    console.error("Error sending invoice rejection notification:", error.message);
    // Don't throw - fail open principle
  }
};

/**
 * Send payment recorded notification
 * @param {Object} invoice - Invoice data
 * @param {number} paidAmount - Amount paid
 * @param {string} paymentDate - Payment date
 * @param {Array<string>} recipientEmails - Array of recipient emails
 * @returns {Promise<void>}
 */
export const sendPaymentRecordedNotification = async (invoice, paidAmount, paymentDate, recipientEmails) => {
  try {
    if (!transporter) {
      console.warn("Email transporter not initialized. Skipping payment notification.");
      return;
    }

    if (!recipientEmails || recipientEmails.length === 0) {
      console.warn("Recipient emails not provided. Skipping notification.");
      return;
    }

    const remainingAmount = Math.max(0, invoice.invoiceAmount - paidAmount);
    const isFullyPaid = remainingAmount === 0;

    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .invoice-info { background-color: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid #FF9800; }
            .invoice-info p { margin: 5px 0; }
            .footer { font-size: 12px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
            .payment-summary { background-color: #e8f5e9; padding: 15px; border-radius: 4px; margin: 15px 0; }
            .payment-summary p { margin: 5px 0; }
            .paid-badge { background-color: #4CAF50; color: white; padding: 5px 10px; border-radius: 3px; display: inline-block; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Payment Recorded</h1>
          </div>
          
          <div class="content">
            <p>Dear Recipient,</p>
            <p>A payment has been recorded for the following invoice:</p>
            
            <div class="invoice-info">
              <p><strong>Invoice Number:</strong> ${invoice.invoiceNo}</p>
              <p><strong>Invoice Amount:</strong> ₹${(invoice.invoiceAmount || 0).toFixed(2)}</p>
              <p><strong>Bill To:</strong> ${invoice.billTo?.name || "N/A"}</p>
            </div>
            
            <div class="payment-summary">
              <p><strong>Amount Paid:</strong> ₹${paidAmount.toFixed(2)}</p>
              <p><strong>Payment Date:</strong> ${new Date(paymentDate).toLocaleDateString()}</p>
              <p><strong>Remaining Balance:</strong> ₹${remainingAmount.toFixed(2)}</p>
              ${isFullyPaid ? `<p><strong>Status:</strong> <span class="paid-badge">FULLY PAID</span></p>` : ""}
            </div>
            
            <p>Thank you for the payment!</p>
            
            <p>Best regards,<br/>
            Accounting Team</p>
          </div>
          
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;

    for (const email of recipientEmails) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER || "accounting@company.com",
        to: email,
        subject: `Payment Recorded: ${invoice.invoiceNo} ${isFullyPaid ? "- FULLY PAID" : ""}`,
        html: htmlContent,
      });
    }

    console.log(`Payment notification sent to ${recipientEmails.length} recipients`);
  } catch (error) {
    console.error("Error sending payment notification:", error.message);
    // Don't throw - fail open principle
  }
};

/**
 * Send due date reminder notification
 * @param {Object} invoice - Invoice data
 * @param {Array<string>} recipientEmails - Array of recipient emails
 * @param {number} daysUntilDue - Days until due
 * @returns {Promise<void>}
 */
export const sendDueReminderNotification = async (invoice, recipientEmails, daysUntilDue) => {
  try {
    if (!transporter) {
      console.warn("Email transporter not initialized. Skipping due reminder notification.");
      return;
    }

    if (!recipientEmails || recipientEmails.length === 0) {
      console.warn("Recipient emails not provided. Skipping notification.");
      return;
    }

    const urgencyClass = daysUntilDue <= 3 ? "critical" : daysUntilDue <= 7 ? "warning" : "info";
    const urgencyColor = daysUntilDue <= 3 ? "#F44336" : daysUntilDue <= 7 ? "#FF9800" : "#2196F3";

    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .header { background-color: ${urgencyColor}; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .invoice-info { background-color: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid ${urgencyColor}; }
            .invoice-info p { margin: 5px 0; }
            .footer { font-size: 12px; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; }
            .urgency { color: ${urgencyColor}; font-weight: bold; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Payment Due Reminder</h1>
          </div>
          
          <div class="content">
            <p>Dear Recipient,</p>
            <p>This is a reminder that payment is due soon. <span class="urgency">${daysUntilDue} days remaining</span></p>
            
            <div class="invoice-info">
              <p><strong>Invoice Number:</strong> ${invoice.invoiceNo}</p>
              <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
              <p><strong>Amount Due:</strong> ₹${(invoice.amountDue || 0).toFixed(2)}</p>
              <p><strong>Bill To:</strong> ${invoice.billTo?.name || "N/A"}</p>
            </div>
            
            <p>Please ensure payment is made by the due date to avoid any delays.</p>
            
            <p>Best regards,<br/>
            Accounting Team</p>
          </div>
          
          <div class="footer">
            <p>This is an automated notification. Please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;

    for (const email of recipientEmails) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER || "accounting@company.com",
        to: email,
        subject: `Payment Due in ${daysUntilDue} Days: ${invoice.invoiceNo}`,
        html: htmlContent,
      });
    }

    console.log(`Due reminder notification sent to ${recipientEmails.length} recipients`);
  } catch (error) {
    console.error("Error sending due reminder notification:", error.message);
    // Don't throw - fail open principle
  }
};
