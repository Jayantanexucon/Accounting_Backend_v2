import express from "express";
import {
  getAuditLogsController,
  getAuditSummaryController,
  getJournalUpdatesController,
  getInvoiceUpdatesController,
  getPurchaseOrderUpdatesController,
} from "./controllers/auditController.js";

import { protect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

// All routes are protected
router.use(protect);

/**
 * @route   GET /api/audit-logs/:companyId
 * @desc    Get all audit logs for a company with optional filtering
 * @access  Private
 * @query   fromDate (optional) - YYYY-MM-DD format
 * @query   toDate (optional) - YYYY-MM-DD format
 * @query   module (optional) - Filter by module name
 * @query   entityType (optional) - Filter by entity type
 * @query   action (optional) - Filter by action
 * @query   limit (optional) - Pagination limit (default: 50)
 * @query   skip (optional) - Pagination skip (default: 0)
 */
router.get("/:companyId", getAuditLogsController);

/**
 * @route   GET /api/audit-logs/:companyId/summary
 * @desc    Get aggregated audit statistics by action type
 * @access  Private
 * @query   entityType (optional) - Filter by entity type
 */
router.get("/:companyId/summary", getAuditSummaryController);

/**
 * @route   GET /api/audit-logs/:companyId/:journalId/journal-updates
 * @desc    Get detailed update history for a specific journal (excludes CREATE/DELETE)
 * @access  Private
 * @query   limit (optional) - Limit of records (default: 100)
 */
router.get("/:companyId/:journalId/journal-updates", getJournalUpdatesController);

/**
 * @route   GET /api/audit-logs/:companyId/:invoiceId/invoice-updates
 * @desc    Get detailed update history for a specific invoice (excludes CREATE/DELETE)
 * @access  Private
 * @query   limit (optional) - Limit of records (default: 100)
 */
router.get("/:companyId/:invoiceId/invoice-updates", getInvoiceUpdatesController);

/**
 * @route   GET /api/audit-logs/:companyId/:poId/po-updates
 * @desc    Get detailed update history for a specific purchase order (excludes CREATE/DELETE)
 * @access  Private
 * @query   limit (optional) - Limit of records (default: 100)
 */
router.get("/:companyId/:poId/po-updates", getPurchaseOrderUpdatesController);

export default router;
