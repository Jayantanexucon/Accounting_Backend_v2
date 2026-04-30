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
  exportInvoiceById,
  exportInvoiceListEndpoint,
} from "../controllers/invoiceController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Create invoice
router.post("/", accessControlMiddleware({ entityKey: "Invoice", action: "CREATE" }), createInvoice);

// Create invoice with automatic journal entry (transactional)
router.post("/with-journal", accessControlMiddleware({ entityKey: "Invoice", action: "CREATE" }), createInvoiceWithJournal);

// Get all invoices (with optional filtering by status, date range)
router.get("/", accessControlMiddleware({ entityKey: "Invoice", action: "READ" }), getAllInvoices);

// Get invoice statistics
router.get("/stats/overview", accessControlMiddleware({ entityKey: "Invoice", action: "READ" }), getInvoiceStats);

// Get pending approvals
router.get("/approvals/pending", accessControlMiddleware({ entityKey: "Invoice", action: "READ" }), getPendingApprovals);

// Search by invoice number
router.get("/search/number", accessControlMiddleware({ entityKey: "Invoice", action: "READ" }), getInvoiceByNumber);

// Get invoices for a specific PO
router.get("/po/:poId", accessControlMiddleware({ entityKey: "Invoice", action: "READ" }), getInvoicesByPO);

// Get single invoice by ID
router.get("/:id", accessControlMiddleware({ entityKey: "Invoice", action: "READ" }), getInvoiceById);

// Update invoice
router.put("/:id", accessControlMiddleware({ entityKey: "Invoice", action: "UPDATE" }), updateInvoice);

// Delete invoice
router.delete("/:id", accessControlMiddleware({ entityKey: "Invoice", action: "DELETE" }), deleteInvoice);

// Approve invoice
router.post("/:id/approve", accessControlMiddleware({ entityKey: "Invoice", action: "APPROVE" }), approveInvoice);

// Reject invoice
router.post("/:id/reject", accessControlMiddleware({ entityKey: "Invoice", action: "APPROVE" }), rejectInvoice);

// Record payment
router.post("/:id/payment", accessControlMiddleware({ entityKey: "Invoice", action: "UPDATE" }), recordPayment);

// Export single invoice
router.get("/:id/export", accessControlMiddleware({ entityKey: "Invoice", action: "READ" }), exportInvoiceById);

// Export invoice list
router.get("/export/list/all", accessControlMiddleware({ entityKey: "Invoice", action: "READ" }), exportInvoiceListEndpoint);

export default router;
