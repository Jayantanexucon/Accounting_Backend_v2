import mongoose, { Schema } from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const notificationSchema = new Schema(
  {
    companyId: {
      type: String,
      required: true,
      index: true,
    },
    recipientId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["INFO", "WARNING", "SUCCESS", "ERROR", "APPROVAL_REQUEST", "APPROVED", "REJECTED"],
      default: "INFO",
    },
    relatedEntity: {
      entityType: {
        type: String,
        enum: ["INVOICE", "JOURNAL", "PO", "PAYMENT"],
      },
      entityId: {
        type: String,
      },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const getNotificationModel = async () => {
  const db = getDatabase("user");
  return db.models.Notification || db.model("Notification", notificationSchema);
};
