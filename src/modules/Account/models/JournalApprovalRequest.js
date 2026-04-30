import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const journalApprovalRequestSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
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
      type: String,
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
      type: String,
      default: null,
    },
    rejectedBy: {
      type: String,
      default: null,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const getJournalApprovalRequestModel = async () => {
  const db = getDatabase("accounting");
  return (
    db.models.JournalApprovalRequest ||
    db.model("JournalApprovalRequest", journalApprovalRequestSchema)
  );
};
