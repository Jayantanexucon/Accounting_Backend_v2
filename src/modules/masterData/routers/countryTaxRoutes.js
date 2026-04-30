import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import {
  createCountryTaxController,
  getAllCountryTaxController,
  getCountryTaxByIdController,
  getCountryTaxByCodeController,
  updateCountryTaxController,
  deleteCountryTaxController,
} from "../controllers/countryTaxController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// GET /api/masterData/countryTax - Get all country tax rates
router.get("/", getAllCountryTaxController);

// GET /api/masterData/countryTax/byCode/:countryCode - Lookup by country code
router.get("/byCode/:countryCode", getCountryTaxByCodeController);

// GET /api/masterData/countryTax/:id - Get by ID
router.get("/:id", getCountryTaxByIdController);

// POST /api/masterData/countryTax - Create
router.post("/", createCountryTaxController);

// PUT /api/masterData/countryTax/:id - Update
router.put("/:id", updateCountryTaxController);

// DELETE /api/masterData/countryTax/:id - Delete
router.delete("/:id", deleteCountryTaxController);

export default router;
