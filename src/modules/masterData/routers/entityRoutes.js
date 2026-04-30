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

// POST /api/masterData/entity - Create entity
router.post(
  "/",
  accessControlMiddleware({ entityKey: "ENTITY", action: "CREATE" }),
  createEntityController
);

// GET /api/masterData/entity/tree - Get hierarchical tree
router.get(
  "/tree",
  accessControlMiddleware({ entityKey: "ENTITY", action: "VIEW" }),
  buildTreeController
);

// GET /api/masterData/entity - Get all entities
router.get(
  "/",
  accessControlMiddleware({ entityKey: "ENTITY", action: "VIEW" }),
  getAllEntitiesController
);

// GET /api/masterData/entity/:entityId/children - Get children of parent entity
router.get(
  "/:entityId/children",
  accessControlMiddleware({ entityKey: "ENTITY", action: "VIEW" }),
  getChildrenOfParentEntityController
);

// GET /api/masterData/entity/:entityId - Get entity by ID
router.get(
  "/:entityId",
  accessControlMiddleware({ entityKey: "ENTITY", action: "VIEW" }),
  getEntityByIdController
);

// PUT /api/masterData/entity/:entityId - Update entity
router.put(
  "/:entityId",
  accessControlMiddleware({ entityKey: "ENTITY", action: "EDIT" }),
  updateEntityController
);

// DELETE /api/masterData/entity/:entityId - Delete entity
router.delete(
  "/:entityId",
  accessControlMiddleware({ entityKey: "ENTITY", action: "DELETE" }),
  deleteEntityController
);

export default router;
