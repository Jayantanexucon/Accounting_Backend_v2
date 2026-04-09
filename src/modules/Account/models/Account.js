import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

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
    // FIXED: subType for balance sheet classification
    subType: {
      type: String,
      enum: ["current", "nonCurrent"],
      default: null,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: [true, "Group ID is required"],
    },
    // FIXED: groupName should be actual group name, not enum
    groupName: {
      type: String,
      required: [true, "Group name is required"],
      trim: true,
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
      enum: ["debit", "credit"],
      required: [true, "Opening type is required"],
    },
    // FIXED: Add scheduleMapping for reporting
    scheduleMapping: {
      scheduleMainHead: {
        type: String,
        enum: ["Assets", "Equity and Liabilities", "P&L", null],
        default: null,
      },
      scheduleGroup: {
        type: String,
        trim: true,
        default: null,
      },
      scheduleLineItem: {
        type: String,
        trim: true,
        default: null,
      },
      noteNo: {
        type: String,
        trim: true,
        default: null,
      },
      reportType: {
        type: String,
        enum: ["balance_sheet", "profit_and_loss", null],
        default: null,
      },
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
    // Denormalized party info for reporting efficiency
    linkedPartyType: {
      type: String,
      enum: ["client", "vendor", null],
      default: null,
    },
    partyName: {
      type: String,
      default: null,
    },
    partyCode: {
      type: String,
      default: null,
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
  const db = getDatabase("accounting");
  return db.models.Account || db.model("Account", accountSchema);
};
