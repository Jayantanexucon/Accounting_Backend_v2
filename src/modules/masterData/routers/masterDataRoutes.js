import express from "express";
import countryRoutes from "./countryRoutes.js";
import stateRoutes from "./stateRoutes.js";
import cityRoutes from "./cityRoutes.js";
import currencyRoutes from "./currencyRoutes.js";
import menuRoutes from "./menuRoutes.js";
import entityRoutes from "./entityRoutes.js";
import clientRoutes from "./clientRoutes.js";
import vendorRoutes from "./vendorRoutes.js";
import hsnRoutes from "./hsnRoutes.js";

const router = express.Router();

// Mount all master data routes
router.use("/country", countryRoutes);
router.use("/state", stateRoutes);
router.use("/city", cityRoutes);
router.use("/currency", currencyRoutes);
router.use("/menu", menuRoutes);
router.use("/entity", entityRoutes);
router.use("/client", clientRoutes);
router.use("/vendor", vendorRoutes);
router.use("/hsn", hsnRoutes);

export default router;
