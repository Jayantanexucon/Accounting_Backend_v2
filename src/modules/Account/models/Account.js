import mongoose from "mongoose";
import { connectAccountingDB } from "../../../config/db/accounting.db.js";

const accountSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Account code is required"],
      trim: true,
      indexed: true,
    },
    name: {
      type: String,
      required: [true, "Account name is required"],
      trim: true,
    },
    type: {
      type: String,
      enum: ["balanceSheet", "revenueAccount"],
      required: [true, "Account type is required"],
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: [true, "Group ID is required"],
    },
    groupName: {
      type: String,
      enum: ["Asset", "Liability", "Equity", "Income", "Expense"],
      required: [true, "Group name is required"],
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: [true, "Company ID is required"],
      indexed: true,
    },
    openingBalance: {
      type: Number,
      default: 0,
    },
    openingType: {
      type: String,
      enum: ["Debit", "Credit"],
      required: [true, "Opening type is required"],
    },
    // Linking to clients/vendors for ledger accounts
    linkedClientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      default: null,
      sparse: true,
    },
    linkedVendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      default: null,
      sparse: true,
    },
    description: String,
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index on code + companyId
accountSchema.index({ code: 1, companyId: 1 }, { unique: true });

// Sparse unique indexes for linked accounts
accountSchema.index(
  { linkedClientId: 1, companyId: 1 },
  { sparse: true, unique: true }
);
accountSchema.index(
  { linkedVendorId: 1, companyId: 1 },
  { sparse: true, unique: true }
);

export const getAccountModel = async () => {
  const db = await connectAccountingDB();
  return db.models.Account || db.model("Account", accountSchema);
};
