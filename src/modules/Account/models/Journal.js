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
      enum: ["SALES", "PURCHASE", "PAYMENT", "RECEIPT", "CONTRA", "JOURNAL"],
      required: [true, "Voucher type is required"],
    },
    date: {
      type: Date,
      required: [true, "Journal date is required"],
      indexed: true,
    },
    referenceNumber: String,
    externalDocNo: String,
    narration: String,
    companyId: {
      type: String,
      required: [true, "Company ID is required"],
      indexed: true,
    },
    sourceType: {
      type: String,
      enum: ["MANUAL", "INVOICE", "PAYMENT", "ADJUSTMENT", "EXCEL", "REVERSAL"],
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
      type: String,
    },
    approvalDate: Date,
    approvalComments: String,
    createdBy: {
      type: String,
      required: true,
    },
    updatedBy: {
      type: String,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isReconciled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-reconciliation hook
journalSchema.post("save", async function (doc) {
  try {
    if (["Posted", "Approved"].includes(doc.status)) {
      const { BankReconciliationService } = await import("../services/bankReconciliationService.js");
      const { getJournalLineModel } = await import("./JournalLine.js");
      const JournalLine = await getJournalLineModel();
      const lines = await JournalLine.find({ journalId: doc._id }).lean();
      if (lines.length > 0) {
        await BankReconciliationService.processJournalForReconciliation(doc, lines, doc.companyId);
      }
    }
  } catch (error) {
    console.error("Auto-reconciliation hook failed for Journal:", error.message);
  }
});

journalSchema.index({ companyId: 1, date: -1 });
journalSchema.index({ sourceType: 1, sourceId: 1 });

export const getJournalModel = async () => {
  const db = getDatabase("accounting");
  return db.models.Journal || db.model("Journal", journalSchema);
};
