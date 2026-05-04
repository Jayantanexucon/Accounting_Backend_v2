import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import {
  validateInvoiceAccounts,
  createClientLedgerFromInvoice,
  createJournalFromInvoice,
  completeInvoiceAccounting,
  getInvoiceAccountingStatus,
  recordInvoicePayment,
  reverseInvoicePayment,
  getInvoiceTdsReport,
} from "../controllers/invoiceAccountingController.js";

const router = express.Router();

router.use(protect);

router.get(
  "/validate-accounts/:companyId",
  accessControlMiddleware({ entityKey: "INVOICE", action: "VIEW" }),
  validateInvoiceAccounts
);

router.post(
  "/:companyId/create-ledger",
  accessControlMiddleware({ entityKey: "INVOICE", action: "EDIT" }),
  createClientLedgerFromInvoice
);

router.post(
  "/:companyId/create-journal",
  accessControlMiddleware({ entityKey: "INVOICE", action: "EDIT" }),
  createJournalFromInvoice
);

router.post(
  "/:companyId/complete-accounting",
  accessControlMiddleware({ entityKey: "INVOICE", action: "EDIT" }),
  completeInvoiceAccounting
);

router.get(
  "/:companyId/status/:invoiceId",
  accessControlMiddleware({ entityKey: "INVOICE", action: "VIEW" }),
  getInvoiceAccountingStatus
);

router.post(
  "/:companyId/record-payment",
  accessControlMiddleware({ entityKey: "PAYMENT", action: "CREATE" }),
  recordInvoicePayment
);
router.post(
  "/:companyId/reverse-payment",
  accessControlMiddleware({ entityKey: "PAYMENT", action: "EDIT" }),
  reverseInvoicePayment
);
router.get(
  "/:companyId/tds-report",
  accessControlMiddleware({ entityKey: "INVOICE", action: "VIEW" }),
  getInvoiceTdsReport
);

export default router;
