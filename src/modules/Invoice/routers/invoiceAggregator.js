import express from "express";
import purchaseOrderRoutes from "./purchaseOrderRoutes.js";
import invoiceRoutes from "./invoiceRoutes.js";

const router = express.Router();

// Register PO routes under /purchase-order
router.use("/purchase-order", purchaseOrderRoutes);

// Register Invoice routes under /invoice
router.use("/invoice", invoiceRoutes);

export default router;
