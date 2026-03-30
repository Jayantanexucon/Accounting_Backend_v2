import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import {
  createPayment,
  getAllPayments,
  getPaymentById,
  getPaymentsByClient,
  getPaymentsByInvoice,
  updatePayment,
  deletePayment,
  getPaymentStats,
  reconcilePayment,
  getPendingReconciliations,
  getTDSReport,
} from "../controllers/paymentController.js";

const router = express.Router();

router.use(protect);

router.post("/", accessControlMiddleware({ entityKey: "Payment", action: "CREATE" }), createPayment);

router.get("/", getAllPayments);

router.get("/stats/overview", getPaymentStats);

router.get("/client/search", getPaymentsByClient);

router.get("/invoice/search", getPaymentsByInvoice);

router.get("/reconcile/pending", getPendingReconciliations);

router.get("/report/tds", getTDSReport);

router.get("/:id", getPaymentById);

router.put("/:id", accessControlMiddleware({ entityKey: "Payment", action: "UPDATE" }), updatePayment);

router.post("/:id/reconcile", accessControlMiddleware({ entityKey: "Payment", action: "RECONCILE" }), reconcilePayment);

router.delete("/:id", accessControlMiddleware({ entityKey: "Payment", action: "DELETE" }), deletePayment);

export default router;
