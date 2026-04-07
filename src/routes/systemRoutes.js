import express from "express";
import {
  getAvailableModules,
  getModuleStatus,
  getSystemHealth,
  getUserAccessibleModules,
  getUserEntityPermissions,
} from "../controllers/systemController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

/**
 * Public Endpoints - No authentication required
 * Allows clients to discover available modules and system status
 */

/**
 * Get all available modules
 * GET /api/system/modules
 * 
 * Response: List of all available modules with metadata including:
 * - Module name and description
 * - Enabled status
 * - API path for the module
 * - List of features provided
 * - Database used
 */
router.get("/modules", getAvailableModules);

/**
 * Get status of a specific module
 * GET /api/system/module-status?module=accounting
 * 
 * Query Parameters:
 * - module: Name of the module to check (accounting, invoice, etc.)
 * 
 * Response: Boolean status indicating if module is enabled
 */
router.get("/module-status", getModuleStatus);

/**
 * Get system health and database status
 * GET /api/system/health
 * 
 * Response: System health information including:
 * - Server uptime
 * - Environment
 * - Database connection status
 * - Enabled modules
 */
router.get("/health", getSystemHealth);

/**
 * Protected Endpoints - Require authentication
 * User-specific module and permission discovery
 */

/**
 * Get modules accessible to authenticated user
 * GET /api/system/my-modules?companyId=xxx
 * 
 * Authentication: Required (Bearer token)
 * Query Parameters:
 * - companyId: Company ID to check permissions for (required)
 * 
 * Response: Modules accessible to the user based on:
 * - User role (superAdmin gets all, others filtered by permissions)
 * - User permissions for the company
 * - Available modules (AVAILABLE_MODULE env var)
 * 
 * Used by frontend to:
 * - Populate navigation menu dynamically
 * - Show only modules user has access to
 * - Control access based on backend configuration
 */
router.get(
  "/my-modules",
  protect,
  getUserAccessibleModules
);

/**
 * Get user's entity permissions
 * GET /api/system/my-permissions?companyId=xxx
 * 
 * Authentication: Required (Bearer token)
 * Query Parameters:
 * - companyId: Company ID to get permissions for (required)
 * 
 * Response: Entity table with features and user's specific permissions:
 * - Available entities for the company
 * - Features within each entity
 * - User's actions (CREATE, EDIT, DELETE, VIEW)
 * - Disabled entities info (for admins)
 * 
 * Used by frontend to:
 * - Populate entity dropdown dynamically
 * - Show only entities/features user can access
 * - Control feature visibility based on permissions
 * - Prevent manual entity creation (entities only come from backend)
 */
router.get(
  "/my-permissions",
  protect,
  getUserEntityPermissions
);

export default router;
