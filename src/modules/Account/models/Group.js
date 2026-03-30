import mongoose from "mongoose";
import { connectAccountingDB } from "../../../config/db/accounting.db.js";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Group name is required"],
      unique: true,
      trim: true,
    },
    nature: {
      type: String,
      enum: ["Debit", "Credit"],
      required: [true, "Nature is required"],
    },
    balanceType: {
      type: String,
      enum: ["Asset", "Liability", "Equity", "Income", "Expense"],
      required: [true, "Balance type is required"],
    },
    companyId: {
      type: String,
      required: [true, "Company ID is required"],
      indexed: true,
    },
    createdBy: String,
    updatedBy: String,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index on name + companyId
groupSchema.index({ name: 1, companyId: 1 }, { unique: true });

export const getGroupModel = async () => {
  const db = await connectAccountingDB();
  return db.models.Group || db.model("Group", groupSchema);
};
