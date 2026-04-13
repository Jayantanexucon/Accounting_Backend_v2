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
} from "../controllers/invoiceAccountingController.js";

const router = express.Router();

router.use(protect);

router.get(
  "/validate-accounts/:companyId",
  accessControlMiddleware({ entityKey: "Invoice", action: "READ" }),
  validateInvoiceAccounts
);

router.post(
  "/:companyId/create-ledger",
  accessControlMiddleware({ entityKey: "Invoice", action: "UPDATE" }),
  createClientLedgerFromInvoice
);

router.post(
  "/:companyId/create-journal",
  accessControlMiddleware({ entityKey: "Invoice", action: "UPDATE" }),
  createJournalFromInvoice
);

router.post(
  "/:companyId/complete-accounting",
  accessControlMiddleware({ entityKey: "Invoice", action: "UPDATE" }),
  completeInvoiceAccounting
);

router.get(
  "/:companyId/status/:invoiceId",
  accessControlMiddleware({ entityKey: "Invoice", action: "READ" }),
  getInvoiceAccountingStatus
);

router.post(
  "/:companyId/record-payment",
  accessControlMiddleware({ entityKey: "Payment", action: "CREATE" }),
  recordInvoicePayment
);

export default router;
