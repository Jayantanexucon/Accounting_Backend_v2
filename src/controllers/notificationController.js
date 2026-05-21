import { getNotificationModel } from "../modules/user/models/Notification.js";
import AppError from "../utils/AppError.js";
import jwt from "jsonwebtoken";

/**
 * Get all notifications for the current user in a specific company
 * GET /api/notifications?companyId=xxx
 */
export const getNotifications = async (req, res, next) => {
  try {
    const { companyId } = req.query;
    if (!companyId) {
      return next(new AppError("Company ID is required", 400));
    }

    const Notification = await getNotificationModel();
    const notifications = await Notification.find({
      companyId,
      recipientId: req.user._id.toString(),
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a specific notification as read
 * PATCH /api/notifications/:id/read
 */
export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyId } = req.body;
    
    if (!companyId) {
      return next(new AppError("Company ID is required", 400));
    }

    const Notification = await getNotificationModel();
    const notification = await Notification.findOneAndUpdate(
      { _id: id, companyId, recipientId: req.user._id.toString() },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return next(new AppError("Notification not found", 404));
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read for the current user
 * PATCH /api/notifications/read-all
 */
export const markAllAsRead = async (req, res, next) => {
  try {
    const { companyId } = req.body;
    
    if (!companyId) {
      return next(new AppError("Company ID is required", 400));
    }

    const Notification = await getNotificationModel();
    await Notification.updateMany(
      { companyId, recipientId: req.user._id.toString(), isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get socket token for real-time notifications
 * GET /api/notifications/socket-token
 */
export const getSocketToken = async (req, res, next) => {
  try {
    // Generate a short-lived token for socket auth
    const token = jwt.sign(
      { id: req.user._id.toString() },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "1h" }
    );
    
    res.status(200).json({
      success: true,
      data: { token },
    });
  } catch (error) {
    next(error);
  }
};
