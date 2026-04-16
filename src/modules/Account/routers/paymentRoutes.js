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

router.post("/", accessControlMiddleware({ entityKey: "PAYMENT", action: "CREATE" }), createPayment);

router.get("/", accessControlMiddleware({ entityKey: "PAYMENT", action: "VIEW" }), getAllPayments);

router.get("/stats/overview", accessControlMiddleware({ entityKey: "PAYMENT", action: "VIEW" }), getPaymentStats);

router.get("/client/search", accessControlMiddleware({ entityKey: "PAYMENT", action: "VIEW" }), getPaymentsByClient);

router.get("/invoice/search", accessControlMiddleware({ entityKey: "PAYMENT", action: "VIEW" }), getPaymentsByInvoice);

router.get("/reconcile/pending", accessControlMiddleware({ entityKey: "PAYMENT", action: "VIEW" }), getPendingReconciliations);

router.get("/report/tds", accessControlMiddleware({ entityKey: "PAYMENT", action: "VIEW" }), getTDSReport);

router.get("/:id", accessControlMiddleware({ entityKey: "PAYMENT", action: "VIEW" }), getPaymentById);

router.put("/:id", accessControlMiddleware({ entityKey: "PAYMENT", action: "EDIT" }), updatePayment);

router.post("/:id/reconcile", accessControlMiddleware({ entityKey: "PAYMENT", action: "EDIT" }), reconcilePayment);

router.delete("/:id", accessControlMiddleware({ entityKey: "PAYMENT", action: "DELETE" }), deletePayment);

export default router;
