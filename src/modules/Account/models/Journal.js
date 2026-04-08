import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const journalSchema = new mongoose.Schema(
  {
    number: {
      type: String,
      required: [true, "Journal number is required"],
      unique: true,
    },
    voucherType: {
      type: String,
      enum: ["Journal Entry", "Receipt", "Payment", "Contra"],
      required: [true, "Voucher type is required"],
    },
    date: {
      type: Date,
      required: [true, "Journal date is required"],
      indexed: true,
    },
    referenceNumber: String,
    narration: String,
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: [true, "Company ID is required"],
      indexed: true,
    },
    sourceType: {
      type: String,
      enum: ["MANUAL", "INVOICE", "PAYMENT"],
      default: "MANUAL",
    },
    sourceId: String,
    partyName: String,
    totalDebit: {
      type: Number,
      default: 0,
    },
    totalCredit: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Draft", "Posted", "Approved", "Rejected"],
      default: "Draft",
    },
    approvalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvalDate: Date,
    approvalComments: String,
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

journalSchema.index({ companyId: 1, date: -1 });
journalSchema.index({ sourceType: 1, sourceId: 1 });

export const getJournalModel = async () => {
  const db = getDatabase("accounting");
  return db.models.Journal || db.model("Journal", journalSchema);
};
