import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import {
  createPurchaseOrder,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrderByNumber,
  getPOStats,
  getPOsByStatus,
} from "../controllers/purchaseOrderController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Create PO
router.post("/", accessControlMiddleware({ entityKey: "PURCHASE_ORDER", action: "CREATE" }), createPurchaseOrder);

// Get all POs (with optional filtering)
router.get("/", accessControlMiddleware({ entityKey: "PURCHASE_ORDER", action: "VIEW" }), getAllPurchaseOrders);

// Get PO statistics
router.get("/stats/overview", accessControlMiddleware({ entityKey: "PURCHASE_ORDER", action: "VIEW" }), getPOStats);

// Get POs by status
router.get("/status/:status", accessControlMiddleware({ entityKey: "PURCHASE_ORDER", action: "VIEW" }), getPOsByStatus);

// Search by PO number
router.get("/search/number", accessControlMiddleware({ entityKey: "PURCHASE_ORDER", action: "VIEW" }), getPurchaseOrderByNumber);

// Get single PO by ID
router.get("/:id", accessControlMiddleware({ entityKey: "PURCHASE_ORDER", action: "VIEW" }), getPurchaseOrderById);

// Update PO
router.put("/:id", accessControlMiddleware({ entityKey: "PURCHASE_ORDER", action: "EDIT" }), updatePurchaseOrder);

// Delete PO
router.delete("/:id", accessControlMiddleware({ entityKey: "PURCHASE_ORDER", action: "DELETE" }), deletePurchaseOrder);

export default router;
