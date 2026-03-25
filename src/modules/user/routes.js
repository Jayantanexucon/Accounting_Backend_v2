import express from "express";
import {
  getAllUsersController,
  createUserBySuperAdmin,
  editUserBySuperAdmin,
  updateUserPermissions,
  getAllCompaniesForUser,
  getCompanyForUserById,
  createCompanyBySuperAdmin,
  updateCompanyBySuperAdmin,
} from "./controllers/userController.js";
import { protect, restrictTo } from "../../middlewares/authMiddleware.js";

const router = express.Router();

// All user routes are protected
router.use(protect);

// Get all users (SuperAdmin only)
router.get("/", restrictTo("superAdmin"), getAllUsersController);

// Create user (SuperAdmin only)
router.post("/", restrictTo("superAdmin"), createUserBySuperAdmin);

// Edit user (SuperAdmin only)
router.put("/:userId", restrictTo("superAdmin"), editUserBySuperAdmin);

// Update user permissions (SuperAdmin only)
router.put(
  "/:userId/permissions",
  restrictTo("superAdmin"),
  updateUserPermissions
);

// Get all companies for authenticated user
router.get("/companies/all", getAllCompaniesForUser);

// Get company by ID
router.get("/companies/:companyId", getCompanyForUserById);

// Create company (SuperAdmin only)
router.post("/company", restrictTo("superAdmin"), createCompanyBySuperAdmin);

// Update company (SuperAdmin only)
router.put(
  "/company/:companyId",
  restrictTo("superAdmin"),
  updateCompanyBySuperAdmin
);

export default router;
