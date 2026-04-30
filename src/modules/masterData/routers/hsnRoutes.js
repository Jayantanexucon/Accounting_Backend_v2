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

// GET /api/hsn - Get all HSN (optional companyId via query param)
router.get(
  "/",
  accessControlMiddleware({ entityKey: "HSN", action: "VIEW" }),
  getAllHSNController
);

// GET /api/hsn/:id - Get HSN by ID (optional companyId via query param)
router.get(
  "/:hsnId",
  accessControlMiddleware({ entityKey: "HSN", action: "VIEW" }),
  getHSNController
);

// PUT /api/hsn/:companyId/:hsnId - Update HSN
router.put(
  "/:companyId/:hsnId",
  accessControlMiddleware({ entityKey: "HSN", action: "EDIT" }),
  updateHSNController
);

// DELETE /api/hsn/:companyId/:hsnId - Delete HSN
router.delete(
  "/:companyId/:hsnId",
  accessControlMiddleware({ entityKey: "HSN", action: "DELETE" }),
  deleteHSNController
);

export default router;
