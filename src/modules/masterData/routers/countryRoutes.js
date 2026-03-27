import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
// from "../../../middlewares/accessBasedMiddleware.js";
import {
  createCountryController,
  getAllCountriesController,
  getCountryByIdController,
  updateCountryController,
  deleteCountryController,
} from "../controllers/countryController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// POST /api/masterData/country/create - Create country
router.post(
  "/create",
  accessControlMiddleware({ entityKey: "COUNTRY", action: "CREATE" }),
  createCountryController
);

// GET /api/masterData/country - Get all countries
router.get(
  "/",
  accessControlMiddleware({ entityKey: "COUNTRY", action: "VIEW" }),
  getAllCountriesController
);

// GET /api/masterData/country/:countryId - Get country by ID
router.get(
  "/:countryId",
  accessControlMiddleware({ entityKey: "COUNTRY", action: "VIEW" }),
  getCountryByIdController
);

// PUT /api/masterData/country/:countryId - Update country
router.put(
  "/:countryId",
  accessControlMiddleware({ entityKey: "COUNTRY", action: "EDIT" }),
  updateCountryController
);

// DELETE /api/masterData/country/:countryId - Delete country
router.delete(
  "/:countryId",
  accessControlMiddleware({ entityKey: "COUNTRY", action: "DELETE" }),
  deleteCountryController
);

export default router;
