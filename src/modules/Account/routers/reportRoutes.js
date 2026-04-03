import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import {
  getLedgerReportHandler,
  getGeneralLedgerHandler,
  getTrialBalanceHandler,
  getTrialBalancePeriodHandler,
  validateTrialBalanceHandler,
  getBalanceSheetHandler,
  getProfitAndLossHandler,
  getFinancialStatementsHandler,
} from "../controllers/reportController.js";

const router = express.Router({ mergeParams: true });

// All routes require authentication
router.use(protect);

/**
 * Ledger Reports
 */

// Single account ledger
// GET /api/accounting/report/:companyId/ledger?accountId=xxx&startDate=xxx&endDate=xxx
router.get(
  "/:companyId/ledger",
  accessControlMiddleware({ entityKey: "Report", action: "READ" }),
  getLedgerReportHandler
);

// General ledger (all accounts)
// GET /api/accounting/report/:companyId/general-ledger?startDate=xxx&endDate=xxx
router.get(
  "/:companyId/general-ledger",
  accessControlMiddleware({ entityKey: "Report", action: "READ" }),
  getGeneralLedgerHandler
);

/**
 * Trial Balance Reports
 */

// Trial balance as of a date
// GET /api/accounting/report/:companyId/trial-balance?asOfDate=xxx
router.get(
  "/:companyId/trial-balance",
  accessControlMiddleware({ entityKey: "Report", action: "READ" }),
  getTrialBalanceHandler
);

// Trial balance for a period (showing opening, movement, closing)
// GET /api/accounting/report/:companyId/trial-balance-period?startDate=xxx&endDate=xxx
router.get(
  "/:companyId/trial-balance-period",
  accessControlMiddleware({ entityKey: "Report", action: "READ" }),
  getTrialBalancePeriodHandler
);

// Validate trial balance (check if balanced)
// GET /api/accounting/report/:companyId/validate-trial-balance?asOfDate=xxx
router.get(
  "/:companyId/validate-trial-balance",
  accessControlMiddleware({ entityKey: "Report", action: "READ" }),
  validateTrialBalanceHandler
);

/**
 * Financial Statement Reports
 */

// Balance sheet
// GET /api/accounting/report/:companyId/balance-sheet?asOfDate=xxx
router.get(
  "/:companyId/balance-sheet",
  accessControlMiddleware({ entityKey: "Report", action: "READ" }),
  getBalanceSheetHandler
);

// Profit & Loss statement
// GET /api/accounting/report/:companyId/profit-loss?startDate=xxx&endDate=xxx
router.get(
  "/:companyId/profit-loss",
  accessControlMiddleware({ entityKey: "Report", action: "READ" }),
  getProfitAndLossHandler
);

// Comprehensive financial statements (all reports + ratios)
// GET /api/accounting/report/:companyId/financial-statements?statementDate=xxx
router.get(
  "/:companyId/financial-statements",
  accessControlMiddleware({ entityKey: "Report", action: "READ" }),
  getFinancialStatementsHandler
);

export default router;
