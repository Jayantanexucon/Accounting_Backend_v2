import express from "express";
import {
  getAvailableModules,
  getModuleStatus,
  getSystemHealth,
} from "../controllers/systemController.js";

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

export default router;
