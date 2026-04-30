import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import upload from "../../../middlewares/multerMiddleware.js";
import {
  addVendorController,
  getPaginatedVendorsController,
  updateVendorController,
  deleteVendorController,
  completeVendorController,
  getVendorByIdController,
  searchVendorsController,
} from "../controllers/vendorController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// GET /api/vendor/search - Search vendors (must be before :companyId to avoid conflicts)
router.get(
  "/search",
  accessControlMiddleware({ entityKey: "VENDOR", action: "VIEW" }),
  searchVendorsController
);

// POST /api/vendor/:companyId - Add vendor with optional file uploads
router.post(
  "/:companyId",
  upload.array("complianceDocs", 10),
  accessControlMiddleware({ entityKey: "VENDOR", action: "CREATE" }),
  addVendorController
);

// GET /api/vendor/:companyId - Get paginated vendors
router.get(
  "/:companyId",
  accessControlMiddleware({ entityKey: "VENDOR", action: "VIEW" }),
  getPaginatedVendorsController
);

// GET /api/vendor/details/:vendorId - Get vendor by ID
router.get(
  "/details/:vendorId",
  accessControlMiddleware({ entityKey: "VENDOR", action: "VIEW" }),
  getVendorByIdController
);

// PUT /api/vendor/update/:vendorId - Update vendor with optional file uploads
router.put(
  "/update/:vendorId",
  upload.array("complianceDocs", 10),
  accessControlMiddleware({ entityKey: "VENDOR", action: "EDIT" }),
  updateVendorController
);

// DELETE /api/vendor/delete/:vendorId - Delete vendor
router.delete(
  "/delete/:vendorId",
  accessControlMiddleware({ entityKey: "VENDOR", action: "DELETE" }),
  deleteVendorController
);

// PUT /api/vendor/complete/:vendorId - Mark vendor as complete
router.put(
  "/complete/:vendorId",
  accessControlMiddleware({ entityKey: "VENDOR", action: "EDIT" }),
  completeVendorController
);

export default router;
