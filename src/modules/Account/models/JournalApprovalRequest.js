import mongoose from "mongoose";
import { connectAccountingDB } from "../../../config/db/accounting.db.js";

const journalApprovalRequestSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    journalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Journal",
      required: true,
    },
    journalNumber: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["edit", "delete"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "completed"],
      default: "pending",
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestComment: {
      type: String,
      trim: true,
      default: "",
    },
    requestedPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: Date,
    rejectedAt: Date,
    completedAt: Date,
  },
  { timestamps: true }
);

journalApprovalRequestSchema.index({ companyId: 1, journalId: 1, type: 1, status: 1 });

export const getJournalApprovalRequestModel = async () => {
  const db = await connectAccountingDB();
  return db.models.JournalApprovalRequest || db.model("JournalApprovalRequest", journalApprovalRequestSchema);
};
