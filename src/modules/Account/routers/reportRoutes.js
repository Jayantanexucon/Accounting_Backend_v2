import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { checkPermission } from "../../../middlewares/accessBasedMiddleware.js";
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
import { getBusinessInsightsHandler } from "../controllers/businessInsightsController.js";

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
  checkPermission("CHART OF ACCOUNTS", "VIEW"),
  getLedgerReportHandler
);

// General ledger (all accounts)
// GET /api/accounting/report/:companyId/general-ledger?startDate=xxx&endDate=xxx
router.get(
  "/:companyId/general-ledger",
  checkPermission("CHART OF ACCOUNTS", "VIEW"),
  getGeneralLedgerHandler
);

/**
 * Trial Balance Reports
 */

// Trial balance as of a date
// GET /api/accounting/report/:companyId/trial-balance?asOfDate=xxx
router.get(
  "/:companyId/trial-balance",
  checkPermission("TRIAL BALANCE", "VIEW"),
  getTrialBalanceHandler
);

// Trial balance for a period (showing opening, movement, closing)
// GET /api/accounting/report/:companyId/trial-balance-period?startDate=xxx&endDate=xxx
router.get(
  "/:companyId/trial-balance-period",
  checkPermission("TRIAL BALANCE", "VIEW"),
  getTrialBalancePeriodHandler
);

// Validate trial balance (check if balanced)
// GET /api/accounting/report/:companyId/validate-trial-balance?asOfDate=xxx
router.get(
  "/:companyId/validate-trial-balance",
  checkPermission("TRIAL BALANCE", "VIEW"),
  validateTrialBalanceHandler
);

/**
 * Financial Statement Reports
 */

// Balance sheet
// GET /api/accounting/report/:companyId/balance-sheet?asOfDate=xxx
router.get(
  "/:companyId/balance-sheet",
  checkPermission("BALANCE SHEET", "VIEW"),
  getBalanceSheetHandler
);

// Profit & Loss statement
// GET /api/accounting/report/:companyId/profit-loss?startDate=xxx&endDate=xxx
router.get(
  "/:companyId/profit-loss",
  checkPermission("PROFIT AND LOSS", "VIEW"),
  getProfitAndLossHandler
);

// Comprehensive financial statements (all reports + ratios)
// GET /api/accounting/report/:companyId/financial-statements?statementDate=xxx
router.get(
  "/:companyId/financial-statements",
  checkPermission("CHART OF ACCOUNTS", "VIEW"),
  getFinancialStatementsHandler
);

// Business insights / management summary
router.get(
  "/:companyId/business-insights",
  checkPermission("CHART OF ACCOUNTS", "VIEW"),
  getBusinessInsightsHandler
);

export default router;
