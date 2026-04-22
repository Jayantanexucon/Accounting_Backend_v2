import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { checkPermission } from "../../../middlewares/accessBasedMiddleware.js";
import {
  createInvoice,
  createInvoiceWithJournal,
  getAllInvoices,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  getInvoiceByNumber,
  getInvoicesByPO,
  getInvoiceStats,
  getPendingApprovals,
  approveInvoice,
  rejectInvoice,
  recordPayment,
  postSalesJournal,
  exportInvoiceById,
  exportInvoiceListEndpoint,
} from "../controllers/invoiceController.js";
import {
  getPOTaxReport,
  getClientTaxReport,
  getTaxSummary,
} from "../controllers/taxReportController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Create invoice
router.post("/", checkPermission("INVOICE", "CREATE"), createInvoice);

// Create invoice with automatic journal entry (transactional)
router.post("/with-journal", checkPermission("INVOICE", "CREATE"), createInvoiceWithJournal);

// Get all invoices (with optional filtering by status, date range)
router.get("/", checkPermission("INVOICE", "VIEW"), getAllInvoices);

// Get invoice statistics
router.get("/stats/overview", checkPermission("INVOICE", "VIEW"), getInvoiceStats);

// Tax flow reports
router.get("/reports/po-tax", checkPermission("INVOICE", "VIEW"), getPOTaxReport);
router.get("/reports/client-tax", checkPermission("INVOICE", "VIEW"), getClientTaxReport);
router.get("/reports/tax-summary", checkPermission("INVOICE", "VIEW"), getTaxSummary);

// Get pending approvals
router.get("/approvals/pending", checkPermission("INVOICE", "VIEW"), getPendingApprovals);

// Search by invoice number
router.get("/search/number", checkPermission("INVOICE", "VIEW"), getInvoiceByNumber);

// Get invoices for a specific PO
router.get("/po/:poId", checkPermission("INVOICE", "VIEW"), getInvoicesByPO);

// Get single invoice by ID
router.get("/:id", checkPermission("INVOICE", "VIEW"), getInvoiceById);

// Update invoice
router.put("/:id", checkPermission("INVOICE", "EDIT"), updateInvoice);

// Delete invoice
router.delete("/:id", checkPermission("INVOICE", "DELETE"), deleteInvoice);

// Approve invoice
router.post("/:id/approve", checkPermission("INVOICE", "EDIT"), approveInvoice);

// Reject invoice
router.post("/:id/reject", checkPermission("INVOICE", "EDIT"), rejectInvoice);

// Record payment
router.post("/:id/payment", checkPermission("INVOICE", "EDIT"), recordPayment);

// Post sales journal
router.post("/:id/post-sales-journal", checkPermission("INVOICE", "EDIT"), postSalesJournal);

// Export single invoice
router.get("/:id/export", checkPermission("INVOICE", "VIEW"), exportInvoiceById);

// Export invoice list
router.get("/export/list/all", checkPermission("INVOICE", "VIEW"), exportInvoiceListEndpoint);

export default router;
