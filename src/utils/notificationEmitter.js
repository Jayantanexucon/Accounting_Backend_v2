import { getNotificationModel } from "../modules/user/models/Notification.js";
import { getUserModel } from "../modules/user/models/User.js";
import { getCompanyModel } from "../modules/company/models/Company.js";
import { getIO } from "./socketHandler.js";

/**
 * Helper to emit a notification via websocket and save to DB
 */
export const emitNotification = async ({
  companyId,
  recipientId,
  title,
  message,
  type = "INFO",
  relatedEntity = {},
  senderName = "System",
}) => {
  try {
    console.log(`[Notification] Sending to user: ${recipientId} | Sent by: ${senderName} | Type: ${type}`);
    const Notification = await getNotificationModel();
    const notification = new Notification({
      companyId,
      recipientId,
      title,
      message,
      type,
      relatedEntity,
    });
    await notification.save();

    const io = getIO();
    io.to(`user_${recipientId}`).emit("new_notification", notification);
  } catch (error) {
    console.error("Error emitting notification:", error);
  }
};

/**
 * Helper to notify all admins of a company
 */
export const notifyCompanyAdmins = async ({
  companyId,
  title,
  message,
  type = "INFO",
  relatedEntity = {},
  senderName = "System",
}) => {
  try {
    const adminIds = new Set();

    // 1. Check Company Model for owner and admin employees
    const Company = await getCompanyModel();
    const company = await Company.findById(companyId);
    if (company) {
      if (company.owner) adminIds.add(company.owner.toString());
      if (company.employees && company.employees.length > 0) {
        company.employees.forEach(emp => {
          if (emp.role === "admin" || emp.role === "superAdmin") {
            adminIds.add(emp.userId.toString());
          }
        });
      }
    }

    // 2. Check User model for superAdmins and users with explicit company permissions
    const User = await getUserModel();
    const admins = await User.find({
      $or: [
        { role: "superAdmin" },
        { role: "admin", "permissions.company": companyId },
      ]
    });
    
    admins.forEach(a => adminIds.add(a._id.toString()));

    console.log(`[Notification] Found ${adminIds.size} admins for company ${companyId}`);

    for (const adminId of adminIds) {
      await emitNotification({
        companyId,
        recipientId: adminId,
        title,
        message,
        type,
        relatedEntity,
        senderName,
      });
    }
  } catch (error) {
    console.error("Error notifying admins:", error);
  }
};
