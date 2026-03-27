import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import {
  createCurrencyController,
  getAllCurrenciesController,
  getCurrencyByIdController,
  updateCurrencyController,
  deleteCurrencyController,
} from "../controllers/currencyController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// POST /api/masterData/currency/create - Create currency
router.post(
  "/create",
  accessControlMiddleware({ entityKey: "CURRENCY", action: "CREATE" }),
  createCurrencyController
);

// GET /api/masterData/currency - Get all currencies
router.get(
  "/",
  accessControlMiddleware({ entityKey: "CURRENCY", action: "VIEW" }),
  getAllCurrenciesController
);

// GET /api/masterData/currency/:currencyId - Get currency by ID
router.get(
  "/:currencyId",
  accessControlMiddleware({ entityKey: "CURRENCY", action: "VIEW" }),
  getCurrencyByIdController
);

// PUT /api/masterData/currency/:currencyId - Update currency
router.put(
  "/:currencyId",
  accessControlMiddleware({ entityKey: "CURRENCY", action: "EDIT" }),
  updateCurrencyController
);

// DELETE /api/masterData/currency/:currencyId - Delete currency
router.delete(
  "/:currencyId",
  accessControlMiddleware({ entityKey: "CURRENCY", action: "DELETE" }),
  deleteCurrencyController
);

export default router;
