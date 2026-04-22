import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { checkPermission } from "../../../middlewares/accessBasedMiddleware.js";
import {
  createPurchaseOrder,
  getAllPurchaseOrders,
  getPurchaseOrderById,
  updatePurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrderByNumber,
  getPOStats,
  getPOsByStatus,
  downloadWordPurchaseOrder,
  downloadPdfPurchaseOrder,
} from "../controllers/purchaseOrderController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Create PO
router.post("/", checkPermission("PURCHASE_ORDER", "CREATE"), createPurchaseOrder);

// Get all POs (with optional filtering)
router.get("/", checkPermission("PURCHASE_ORDER", "VIEW"), getAllPurchaseOrders);

// Get PO statistics
router.get("/stats/overview", checkPermission("PURCHASE_ORDER", "VIEW"), getPOStats);

// Get POs by status
router.get("/status/:status", checkPermission("PURCHASE_ORDER", "VIEW"), getPOsByStatus);

// Search by PO number
router.get("/search/number", checkPermission("PURCHASE_ORDER", "VIEW"), getPurchaseOrderByNumber);

// Get single PO by ID
router.get("/:id", checkPermission("PURCHASE_ORDER", "VIEW"), getPurchaseOrderById);

// Update PO
router.put("/:id", checkPermission("PURCHASE_ORDER", "EDIT"), updatePurchaseOrder);

// Delete PO
router.delete("/:id", checkPermission("PURCHASE_ORDER", "DELETE"), deletePurchaseOrder);

// Download routes
router.get("/:id/download/word", checkPermission("PURCHASE_ORDER", "VIEW"), downloadWordPurchaseOrder);
router.get("/:id/download/pdf", checkPermission("PURCHASE_ORDER", "VIEW"), downloadPdfPurchaseOrder);

export default router;
