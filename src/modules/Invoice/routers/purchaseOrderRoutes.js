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
router.post("/", accessControlMiddleware({ entityKey: "PurchaseOrder", action: "CREATE" }), createPurchaseOrder);

// Get all POs (with optional filtering)
router.get("/", accessControlMiddleware({ entityKey: "PurchaseOrder", action: "READ" }), getAllPurchaseOrders);

// Get PO statistics
router.get("/stats/overview", accessControlMiddleware({ entityKey: "PurchaseOrder", action: "READ" }), getPOStats);

// Get POs by status
router.get("/status/:status", accessControlMiddleware({ entityKey: "PurchaseOrder", action: "READ" }), getPOsByStatus);

// Search by PO number
router.get("/search/number", accessControlMiddleware({ entityKey: "PurchaseOrder", action: "READ" }), getPurchaseOrderByNumber);

// Get single PO by ID
router.get("/:id", accessControlMiddleware({ entityKey: "PurchaseOrder", action: "READ" }), getPurchaseOrderById);

// Update PO
router.put("/:id", accessControlMiddleware({ entityKey: "PurchaseOrder", action: "UPDATE" }), updatePurchaseOrder);

// Delete PO
router.delete("/:id", accessControlMiddleware({ entityKey: "PurchaseOrder", action: "DELETE" }), deletePurchaseOrder);

export default router;
