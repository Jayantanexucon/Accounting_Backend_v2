import mongoose from "mongoose";
import { getDatabase } from "../../../config/databases.js";

const journalLineSchema = new mongoose.Schema(
  {
    journalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Journal",
      required: [true, "Journal ID is required"],
      indexed: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: [true, "Account ID is required"],
      indexed: true,
    },
    accountCode: String,
    accountName: String,
    companyId: {
      type: String,
      required: [true, "Company ID is required"],
      indexed: true,
    },
    debitAmount: {
      type: Number,
      default: 0,
    },
    creditAmount: {
      type: Number,
      default: 0,
    },
    description: String,
    linkedToClientId: {
      type: String,
    },
    linkedToVendorId: {
      type: String,
    },
    lineNumber: Number,
  },
  {
    timestamps: true,
  }
);

journalLineSchema.index({ journalId: 1, accountId: 1 });
journalLineSchema.index({ companyId: 1, accountId: 1 });

export const getJournalLineModel = async () => {
  const db = getDatabase("accounting");
  return db.models.JournalLine || db.model("JournalLine", journalLineSchema);
};
