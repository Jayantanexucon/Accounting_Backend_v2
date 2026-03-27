import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import {
  createHSNController,
  getAllHSNController,
  getHSNController,
  updateHSNController,
  deleteHSNController,
  bulkCreateHSNController,
} from "../controllers/hsnController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// POST /api/hsn/:companyId - Create HSN
router.post(
  "/:companyId",
  accessControlMiddleware({ entityKey: "HSN", action: "CREATE" }),
  createHSNController
);

// POST /api/hsn/:companyId/bulk - Bulk create HSN
router.post(
  "/:companyId/bulk",
  accessControlMiddleware({ entityKey: "HSN", action: "CREATE" }),
  bulkCreateHSNController
);

// GET /api/hsn/:companyId - Get all HSN for company
router.get(
  "/:companyId",
  accessControlMiddleware({ entityKey: "HSN", action: "VIEW" }),
  getAllHSNController
);

// GET /api/hsn/:companyId/:id - Get HSN by ID
router.get(
  "/:companyId/:id",
  accessControlMiddleware({ entityKey: "HSN", action: "VIEW" }),
  getHSNController
);

// PUT /api/hsn/:companyId/:id - Update HSN
router.put(
  "/:companyId/:id",
  accessControlMiddleware({ entityKey: "HSN", action: "EDIT" }),
  updateHSNController
);

// DELETE /api/hsn/:companyId/:id - Delete HSN
router.delete(
  "/:companyId/:id",
  accessControlMiddleware({ entityKey: "HSN", action: "DELETE" }),
  deleteHSNController
);

export default router;
