import express from "express";
import countryRoutes from "./countryRoutes.js";
import stateRoutes from "./stateRoutes.js";
import cityRoutes from "./cityRoutes.js";
import menuRoutes from "./menuRoutes.js";
import entityRoutes from "./entityRoutes.js";
import clientRoutes from "./clientRoutes.js";
import vendorRoutes from "./vendorRoutes.js";
import hsnRoutes from "./hsnRoutes.js";
import countryTaxRoutes from "./countryTaxRoutes.js";

const router = express.Router();

// Mount all master data routes
router.use("/country", countryRoutes);
router.use("/state", stateRoutes);
router.use("/city", cityRoutes);
// Currency is now embedded in Country model - no separate routes needed
router.use("/menu", menuRoutes);
router.use("/entity", entityRoutes);
router.use("/client", clientRoutes);
router.use("/vendor", vendorRoutes);
router.use("/hsn", hsnRoutes);
router.use("/countryTax", countryTaxRoutes);

export default router;
