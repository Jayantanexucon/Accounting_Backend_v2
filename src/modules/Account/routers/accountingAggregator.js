import express from "express";
import groupRoutes from "./groupRoutes.js";
import accountRoutes from "./accountRoutes.js";
import journalRoutes from "./journalRoutes.js";
import journalExcelRoutes from "./journalExcelRoutes.js";
import paymentRoutes from "./paymentRoutes.js";
import accountTypeRoutes from "./accountTypeRoutes.js";
import reportRoutes from "./reportRoutes.js";
import bankReconciliationRoutes from "./bankReconciliationRoutes.js";
import expenseAuditRoutes from "./expenseAuditRoutes.js";

const router = express.Router();

router.use("/group", groupRoutes);
router.use("/account", accountRoutes);
router.use("/journal", journalRoutes);
router.use("/journal-excel", journalExcelRoutes);
router.use("/payment", paymentRoutes);
router.use("/bank-reconciliation", bankReconciliationRoutes);
router.use("/expense-audit", expenseAuditRoutes);
router.use("/account-types", accountTypeRoutes);
router.use("/report", reportRoutes);
router.use("/reports", reportRoutes);

export default router;
