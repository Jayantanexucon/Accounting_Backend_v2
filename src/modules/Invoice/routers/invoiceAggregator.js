import express from "express";
import purchaseOrderRoutes from "./purchaseOrderRoutes.js";
import invoiceRoutes from "./invoiceRoutes.js";

const router = express.Router();

// Register PO routes under /purchase-order
router.use("/purchase-order", purchaseOrderRoutes);

// Register Invoice routes directly (no /invoice prefix since it's already at /api/invoices)
router.use("/", invoiceRoutes);

export default router;
