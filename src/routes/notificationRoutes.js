import express from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getSocketToken,
} from "../controllers/notificationController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getNotifications);
router.get("/socket-token", getSocketToken);
router.patch("/read-all", markAllAsRead);
router.patch("/:id/read", markAsRead);

export default router;
