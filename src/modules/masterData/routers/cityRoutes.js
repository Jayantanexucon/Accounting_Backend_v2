import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import {
  createCityController,
  getCitiesByStateController,
  getAllCitiesController,
  getCityByIdController,
  updateCityController,
  deleteCityController,
} from "../controllers/cityController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// POST /api/masterData/city/create - Create city
router.post(
  "/create",
  accessControlMiddleware({ entityKey: "CITY", action: "CREATE" }),
  createCityController
);

// GET /api/masterData/city/state/:stateId - Get cities by state
router.get(
  "/state/:stateId",
  accessControlMiddleware({ entityKey: "CITY", action: "VIEW" }),
  getCitiesByStateController
);

// GET /api/masterData/city - Get all cities
router.get(
  "/",
  accessControlMiddleware({ entityKey: "CITY", action: "VIEW" }),
  getAllCitiesController
);

// GET /api/masterData/city/:cityId - Get city by ID
router.get(
  "/:cityId",
  accessControlMiddleware({ entityKey: "CITY", action: "VIEW" }),
  getCityByIdController
);

// PUT /api/masterData/city/:cityId - Update city
router.put(
  "/:cityId",
  accessControlMiddleware({ entityKey: "CITY", action: "EDIT" }),
  updateCityController
);

// DELETE /api/masterData/city/:cityId - Delete city
router.delete(
  "/:cityId",
  accessControlMiddleware({ entityKey: "CITY", action: "DELETE" }),
  deleteCityController
);

export default router;
