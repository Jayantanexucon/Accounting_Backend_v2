import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import {
  createEntityController,
  getAllEntitiesController,
  getEntityByIdController,
  updateEntityController,
  deleteEntityController,
  getChildrenOfParentEntityController,
  buildTreeController,
} from "../controllers/entityController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// POST /api/masterData/entity - Create entity (Admin only - no entity-level access control)
router.post(
  "/",
  createEntityController
);

// GET /api/masterData/entity/tree - Get hierarchical tree (No entity-level access control - needed by navbar)
router.get(
  "/tree",
  buildTreeController
);

// GET /api/masterData/entity - Get all entities (No entity-level access control - needed by navbar for menu building)
router.get(
  "/",
  getAllEntitiesController
);

// GET /api/masterData/entity/:entityId/children - Get children of parent entity (No entity-level access control)
router.get(
  "/:entityId/children",
  getChildrenOfParentEntityController
);

// GET /api/masterData/entity/:entityId - Get entity by ID (No entity-level access control)
router.get(
  "/:entityId",
  getEntityByIdController
);

// PUT /api/masterData/entity/:entityId - Update entity
// System resource - only requires authentication, not entity-level access control
router.put(
  "/:entityId",
  updateEntityController
);

// DELETE /api/masterData/entity/:entityId - Delete entity
// System resource - only requires authentication, not entity-level access control
router.delete(
  "/:entityId",
  deleteEntityController
);

export default router;
