import express from "express";
import { protect } from "../../../middlewares/authMiddleware.js";
import { accessControlMiddleware } from "../../../middlewares/accessBasedMiddleware.js";
import {
  createMenuController,
  getAllMenusController,
  getMenuByIdController,
  updateMenuController,
  deleteMenuController,
} from "../controllers/menuController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// POST /api/masterData/menu/create - Create menu item
router.post(
  "/create",
  accessControlMiddleware({ entityKey: "MENU", action: "CREATE" }),
  createMenuController
);

// GET /api/masterData/menu - Get all menu items (optional ?category query)
router.get(
  "/",
  accessControlMiddleware({ entityKey: "MENU", action: "VIEW" }),
  getAllMenusController
);

// GET /api/masterData/menu/:menuId - Get menu item by ID
router.get(
  "/:menuId",
  accessControlMiddleware({ entityKey: "MENU", action: "VIEW" }),
  getMenuByIdController
);

// PUT /api/masterData/menu/:menuId - Update menu item
router.put(
  "/:menuId",
  accessControlMiddleware({ entityKey: "MENU", action: "EDIT" }),
  updateMenuController
);

// DELETE /api/masterData/menu/:menuId - Delete menu item
router.delete(
  "/:menuId",
  accessControlMiddleware({ entityKey: "MENU", action: "DELETE" }),
  deleteMenuController
);

export default router;
