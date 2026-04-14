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
      enum: ["MANUAL", "INVOICE", "PAYMENT", "ADJUSTMENT", "EXCEL"],
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
journalSchema.post("save", async function (doc, next) {
  try {
    // Only attempt reconciliation for Posted journals
    if (doc.status === "Posted") {
      const { BankReconciliationService } = await import("../services/bankReconciliationService.js");
      const { getJournalLineModel } = await import("./JournalLine.js");
      
      const JournalLine = await getJournalLineModel();
      const lines = await JournalLine.find({ journalId: doc._id }).lean();
      
      for (const line of lines) {
        const isBank = await BankReconciliationService.isBankLedger(line.accountId, doc.companyId);
        if (isBank) {
          await BankReconciliationService.autoReconcile({
            id: doc._id,
            companyId: doc.companyId,
            amount: line.debitAmount || line.creditAmount,
            date: doc.date,
            referenceNo: doc.referenceNumber,
            narration: doc.narration,
            bankLedgerId: line.accountId,
            type: "JOURNAL",
          });
        }
      }
    }
  } catch (error) {
    console.error("Auto-reconciliation hook failed for Journal:", error.message);
  }
  next();
});

journalSchema.index({ companyId: 1, date: -1 });
journalSchema.index({ sourceType: 1, sourceId: 1 });

export const getJournalModel = async () => {
  const db = getDatabase("accounting");
  return db.models.Journal || db.model("Journal", journalSchema);
};
