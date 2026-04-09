import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Group name is required"],
      trim: true,
    },
    // FIXED: nature defines accounting classification
    nature: {
      type: String,
      enum: ["Asset", "Liability", "Equity", "Income", "Expense"],
      required: [true, "Nature is required"],
    },
    // FIXED: balanceType defines normal debit/credit balance
    balanceType: {
      type: String,
      enum: ["Debit", "Credit"],
      required: [true, "Balance type is required"],
    },
    // Schedule III Mapping fields
    scheduleMainHead: {
      type: String,
      enum: ["Assets", "Equity and Liabilities", "P&L"],
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
    scheduleMapping: {
      reportType: {
        type: String,
        enum: ["balance_sheet", "profit_and_loss", null],
        default: null,
      },
      primaryHead: {
        type: String,
        trim: true,
        default: null,
      },
      subHead: {
        type: String,
        trim: true,
        default: null,
      },
      lineItemCode: {
        type: String,
        trim: true,
        default: null,
      },
      lineItemName: {
        type: String,
        trim: true,
        default: null,
      },
      noteNo: {
        type: String,
        trim: true,
        default: null,
      },
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: [true, "Company ID is required"],
      indexed: true,
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

// Derive schedule mapping during validation without callback-style middleware.
groupSchema.pre("validate", function () {
  if (this.scheduleMainHead && this.scheduleLineItem) {
    this.scheduleMapping = {
      reportType: this.scheduleMainHead === "P&L" ? "profit_and_loss" : "balance_sheet",
      primaryHead: this.scheduleMainHead,
      subHead: this.scheduleGroup,
      lineItemCode: this.scheduleLineItem,
      lineItemName: this.scheduleLineItem,
      noteNo: this.noteNo || null,
    };
    return;
  }

  this.scheduleMapping = {
    reportType: null,
    primaryHead: null,
    subHead: null,
    lineItemCode: null,
    lineItemName: null,
    noteNo: this.noteNo || null,
  };
});

export const getGroupModel = async () => {
  const db = getDatabase("accounting");
  return db.models.Group || db.model("Group", groupSchema);
};
