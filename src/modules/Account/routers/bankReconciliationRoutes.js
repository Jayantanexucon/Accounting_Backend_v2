import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import {
  autoReconcileBankTransactions,
  createPaymentFromBankTransaction,
  getBankReconciliationStatement,
  getReconciliationOverview,
  importBankTransactions,
  manualReconcileBankTransaction,
  unlinkReconciliation,
} from "../controllers/bankReconciliationController.js";

const router = express.Router();

router.use(protect);

router.get("/overview/:companyId", getReconciliationOverview);
router.get("/brs/:companyId", getBankReconciliationStatement);
router.post("/bank/import", importBankTransactions);
router.post("/reconcile/auto/:companyId", autoReconcileBankTransactions);
router.post("/reconcile/manual", manualReconcileBankTransaction);
router.post("/reconcile/unlink", unlinkReconciliation);
router.post("/reconcile/create-payment", createPaymentFromBankTransaction);

export default router;
