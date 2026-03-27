import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import {
  createStateController,
  getStatesByCountryController,
  getAllStatesController,
  getStateByIdController,
  updateStateController,
  deleteStateController,
} from "../controllers/stateController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// POST /api/masterData/state/create - Create state
router.post(
  "/create",
  accessControlMiddleware({ entityKey: "STATE", action: "CREATE" }),
  createStateController
);

// GET /api/masterData/state/country/:countryId - Get states by country
router.get(
  "/country/:countryId",
  accessControlMiddleware({ entityKey: "STATE", action: "VIEW" }),
  getStatesByCountryController
);

// GET /api/masterData/state - Get all states
router.get(
  "/",
  accessControlMiddleware({ entityKey: "STATE", action: "VIEW" }),
  getAllStatesController
);

// GET /api/masterData/state/:stateId - Get state by ID
router.get(
  "/:stateId",
  accessControlMiddleware({ entityKey: "STATE", action: "VIEW" }),
  getStateByIdController
);

// PUT /api/masterData/state/:stateId - Update state
router.put(
  "/:stateId",
  accessControlMiddleware({ entityKey: "STATE", action: "EDIT" }),
  updateStateController
);

// DELETE /api/masterData/state/:stateId - Delete state
router.delete(
  "/:stateId",
  accessControlMiddleware({ entityKey: "STATE", action: "DELETE" }),
  deleteStateController
);

export default router;
