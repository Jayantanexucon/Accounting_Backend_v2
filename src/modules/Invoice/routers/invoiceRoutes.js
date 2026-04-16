import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
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
router.post("/", accessControlMiddleware({ entityKey: "INVOICE", action: "CREATE" }), createInvoice);

// Create invoice with automatic journal entry (transactional)
router.post("/with-journal", accessControlMiddleware({ entityKey: "INVOICE", action: "CREATE" }), createInvoiceWithJournal);

// Get all invoices (with optional filtering by status, date range)
router.get("/", accessControlMiddleware({ entityKey: "INVOICE", action: "VIEW" }), getAllInvoices);

// Get invoice statistics
router.get("/stats/overview", accessControlMiddleware({ entityKey: "INVOICE", action: "VIEW" }), getInvoiceStats);

// Tax flow reports
router.get("/reports/po-tax", accessControlMiddleware({ entityKey: "INVOICE", action: "VIEW" }), getPOTaxReport);
router.get("/reports/client-tax", accessControlMiddleware({ entityKey: "INVOICE", action: "VIEW" }), getClientTaxReport);
router.get("/reports/tax-summary", accessControlMiddleware({ entityKey: "INVOICE", action: "VIEW" }), getTaxSummary);

// Get pending approvals
router.get("/approvals/pending", accessControlMiddleware({ entityKey: "INVOICE", action: "VIEW" }), getPendingApprovals);

// Search by invoice number
router.get("/search/number", accessControlMiddleware({ entityKey: "INVOICE", action: "VIEW" }), getInvoiceByNumber);

// Get invoices for a specific PO
router.get("/po/:poId", accessControlMiddleware({ entityKey: "INVOICE", action: "VIEW" }), getInvoicesByPO);

// Get single invoice by ID
router.get("/:id", accessControlMiddleware({ entityKey: "INVOICE", action: "VIEW" }), getInvoiceById);

// Update invoice
router.put("/:id", accessControlMiddleware({ entityKey: "INVOICE", action: "EDIT" }), updateInvoice);

// Delete invoice
router.delete("/:id", accessControlMiddleware({ entityKey: "INVOICE", action: "DELETE" }), deleteInvoice);

// Approve invoice
router.post("/:id/approve", accessControlMiddleware({ entityKey: "INVOICE", action: "EDIT" }), approveInvoice);

// Reject invoice
router.post("/:id/reject", accessControlMiddleware({ entityKey: "INVOICE", action: "EDIT" }), rejectInvoice);

// Record payment
router.post("/:id/payment", accessControlMiddleware({ entityKey: "INVOICE", action: "EDIT" }), recordPayment);

// Post sales journal
router.post("/:id/post-sales-journal", accessControlMiddleware({ entityKey: "INVOICE", action: "EDIT" }), postSalesJournal);

// Export single invoice
router.get("/:id/export", accessControlMiddleware({ entityKey: "INVOICE", action: "VIEW" }), exportInvoiceById);

// Export invoice list
router.get("/export/list/all", accessControlMiddleware({ entityKey: "INVOICE", action: "VIEW" }), exportInvoiceListEndpoint);

export default router;
